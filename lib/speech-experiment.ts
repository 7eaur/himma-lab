import { analyzeReading, normalizeArabic } from "@/lib/analysis";

export type SpeechMode = "targeted_pronunciation" | "lexical" | "fluency";
export type DecisionState = "correct" | "incorrect" | "retry_required";

export type TestCase = {
  key: string;
  label: string;
  text: string;
  mode: SpeechMode;
  focus: string | null;
  proxyTargetKey?: string;
};

export const TEST_CASES: TestCase[] = [
  { key: "haraka-ma", label: "مَ — فتحة قصيرة", text: "مَ", mode: "targeted_pronunciation", focus: "short_vowel_fatha", proxyTargetKey: "l1-r5-1" },
  { key: "haraka-bi", label: "بِ — كسرة قصيرة", text: "بِ", mode: "targeted_pronunciation", focus: "short_vowel_kasra", proxyTargetKey: "l2-core2-2" },
  { key: "haraka-bu", label: "بُ — ضمة قصيرة", text: "بُ", mode: "targeted_pronunciation", focus: "short_vowel_damma", proxyTargetKey: "l1-r5-2" },
  { key: "haraka-si", label: "سِ — كسرة قصيرة", text: "سِ", mode: "targeted_pronunciation", focus: "short_vowel_kasra", proxyTargetKey: "l1-r5-3" },
  { key: "haraka-su", label: "سُ — ضمة قصيرة", text: "سُ", mode: "targeted_pronunciation", focus: "short_vowel_damma", proxyTargetKey: "l2-core2-3" },
  { key: "haraka-qa", label: "قَ — فتحة قصيرة", text: "قَ", mode: "targeted_pronunciation", focus: "short_vowel_fatha", proxyTargetKey: "l1-r5-4" },
  { key: "haraka-qi", label: "قِ — كسرة قصيرة", text: "قِ", mode: "targeted_pronunciation", focus: "short_vowel_kasra", proxyTargetKey: "l2-core2-4" },
  { key: "haraka-ra", label: "رَ — فتحة قصيرة", text: "رَ", mode: "targeted_pronunciation", focus: "short_vowel_fatha", proxyTargetKey: "l2-core2-5" },
  { key: "haraka-ru", label: "رُ — ضمة قصيرة", text: "رُ", mode: "targeted_pronunciation", focus: "short_vowel_damma", proxyTargetKey: "l1-r5-5" },
  { key: "word-sukun", label: "شَمْس — سكون", text: "شَمْس", mode: "targeted_pronunciation", focus: "sukun", proxyTargetKey: "pre-20" },
  { key: "word-shadda", label: "قِطَّة — شدة", text: "قِطَّة", mode: "targeted_pronunciation", focus: "shadda", proxyTargetKey: "pre-22" },
  { key: "word-madd", label: "بَاب — مد", text: "بَاب", mode: "targeted_pronunciation", focus: "madd", proxyTargetKey: "pre-21" },
  { key: "sentence-1", label: "جملة قصيرة بدون تشكيل كثيف", text: "يقرأ سالم كتابا.", mode: "lexical", focus: null, proxyTargetKey: "pre-23" },
  { key: "sentence-2", label: "جملة قصيرة ثانية", text: "تلعب مريم بالكرة.", mode: "lexical", focus: null, proxyTargetKey: "post-23" },
  { key: "passage-short", label: "نص قصير", text: "ذهبت هند إلى الحديقة. شاهدت زهرة جميلة. سقت الزهرة بالماء، ثم عادت إلى البيت.", mode: "lexical", focus: null, proxyTargetKey: "l3-r4" },
  { key: "fluency-short", label: "طلاقة", text: "دخل خالد مكتبة المدرسة في وقت الفسحة. بحث عن كتاب عن الحيوانات، فساعده أمين المكتبة. جلس في مكان هادئ وقرأ الكتاب، ثم أعاده إلى مكانه.", mode: "fluency", focus: "timed_passage", proxyTargetKey: "l3-core6" },
]

const TARGET_ALIASES: Record<string, string[]> = {
  "مَ": ["م", "ما", "ماء", "ma"],
  "مِ": ["م", "مي", "mi"],
  "مُ": ["م", "مو", "mu"],
  "بَ": ["ب", "با", "باء", "ba"],
  "بِ": ["ب", "بي", "bi"],
  "بُ": ["ب", "بو", "bu"],
};

function normalized(value: string) {
  return normalizeArabic(value).toLocaleLowerCase("ar");
}

export function aliasEvidence(referenceText: string, transcript: string | null) {
  if (!transcript?.trim()) return { matched: false, matchedAlias: null, effect: null };
  const aliases = TARGET_ALIASES[referenceText.normalize("NFC")] || [];
  const observed = normalized(transcript);
  const matchedAlias = aliases.find((alias) => normalized(alias) === observed) || null;
  return {
    matched: Boolean(matchedAlias),
    matchedAlias,
    effect: matchedAlias ? "do_not_fail_from_asr_only" : null,
  };
}

export function decisionPreview(mode: SpeechMode, referenceText: string, transcript: string | null) {
  const reading = analyzeReading(referenceText, transcript);
  const alias = aliasEvidence(referenceText, transcript);

  if (!transcript?.trim()) {
    return { state: "retry_required" as DecisionState, reason: "no_transcript", reading, alias };
  }

  if (mode === "lexical") {
    const errors = (reading.deletion || 0) + (reading.insertion || 0) + (reading.substitution || 0);
    if (errors === 0) return { state: "correct" as DecisionState, reason: "exact_lexical_match", reading, alias };
    return { state: "retry_required" as DecisionState, reason: "lexical_mismatch_needs_confirmation", reading, alias };
  }

  if (mode === "targeted_pronunciation") {
    return {
      state: "retry_required" as DecisionState,
      reason: alias.matched ? "asr_alias_requires_pronunciation_evidence" : "pronunciation_evidence_required",
      reading,
      alias,
    };
  }

  return { state: "retry_required" as DecisionState, reason: "fluency_policy_pending", reading, alias };
}
