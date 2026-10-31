export type LetterAliasKind = "bare_letter" | "long_vowel_spelling" | "latin_transliteration";
export type LetterAliasCandidate = { text: string; kind: LetterAliasKind };

export type LetterAliasEvidence = {
  matched: boolean;
  matchedAlias: string | null;
  matchKind: LetterAliasKind | "exact_vowelled_text" | null;
  effect: "do_not_fail_from_asr_only" | null;
  vowelVerified: false;
  warning: string | null;
};

const HARAKAT = /[\u064B-\u0652\u0670]/u;
const EDGE_PUNCTUATION = /^[\s.,!?:;؛،؟"'“”‘’()\[\]{}ـ]+|[\s.,!?:;؛،؟"'“”‘’()\[\]{}ـ]+$/gu;

function normalizeTranscript(value: string) {
  return value.normalize("NFC").replace(EDGE_PUNCTUATION, "").trim().toLowerCase()
    .replace(/[إأآٱ]/gu, "ا").replace(/ى/gu, "ي");
}

export function matchTargetedLetterAlias(
  transcript: string | null,
  reference: string,
  candidates: readonly LetterAliasCandidate[],
): LetterAliasEvidence {
  const unmatched: LetterAliasEvidence = {
    matched: false, matchedAlias: null, matchKind: null, effect: null,
    vowelVerified: false, warning: null,
  };
  if (!transcript?.trim()) return unmatched;

  const observed = normalizeTranscript(transcript);
  const expected = normalizeTranscript(reference);
  if (!observed) return unmatched;

  // If Azure explicitly returned a DIFFERENT haraka, never erase that
  // mismatch by stripping diacritics and matching just the consonant.
  if (HARAKAT.test(observed)) {
    return observed === expected
      ? {
          matched: true, matchedAlias: reference, matchKind: "exact_vowelled_text",
          effect: "do_not_fail_from_asr_only", vowelVerified: false,
          warning: "asr_text_is_not_pronunciation_proof",
        }
      : unmatched;
  }

  const candidate = candidates.find((item) => normalizeTranscript(item.text) === observed);
  if (!candidate) return unmatched;

  return {
    matched: true,
    matchedAlias: candidate.text,
    matchKind: candidate.kind,
    effect: "do_not_fail_from_asr_only",
    vowelVerified: false,
    warning: candidate.kind === "long_vowel_spelling"
      ? "short_vowel_vs_long_vowel_unverified"
      : "asr_spelling_does_not_verify_haraka",
  };
}
