export type AlignmentStatus = "correct" | "substitution" | "deletion" | "insertion";

export type AlignmentUnit = {
  status: AlignmentStatus;
  reference: string | null;
  observed: string | null;
};

export type PronunciationUnit = {
  letter: string;
  marks: string[];
  index: number;
};

const HARAKA_NAMES: Record<string, string> = {
  "َ": "فتحة",
  "ِ": "كسرة",
  "ُ": "ضمة",
  "ْ": "سكون",
  "ّ": "شدة",
  "ً": "تنوين فتح",
  "ٍ": "تنوين كسر",
  "ٌ": "تنوين ضم",
};

const DIACRITICS = /[\u064B-\u0652\u0670]/g;
const PUNCTUATION = /[\u060C\u061B\u061F.,!?؛،؟:"'()\[\]{}ـ]/g;

export function stripDiacritics(value: string) {
  return value.normalize("NFC").replace(DIACRITICS, "");
}

export function normalizeArabic(value: string) {
  return stripDiacritics(value)
    .replace(PUNCTUATION, " ")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  const normalized = normalizeArabic(value);
  return normalized ? normalized.split(" ") : [];
}

export function alignWords(referenceText: string, observedText: string): AlignmentUnit[] {
  const reference = tokens(referenceText);
  const observed = tokens(observedText);
  const rows = reference.length + 1;
  const cols = observed.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitution = dp[i - 1][j - 1] + (reference[i - 1] === observed[j - 1] ? 0 : 1);
      const deletion = dp[i - 1][j] + 1;
      const insertion = dp[i][j - 1] + 1;
      dp[i][j] = Math.min(substitution, deletion, insertion);
    }
  }

  const result: AlignmentUnit[] = [];
  let i = reference.length;
  let j = observed.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const equal = reference[i - 1] === observed[j - 1];
      const cost = equal ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + cost) {
        result.push({ status: equal ? "correct" : "substitution", reference: reference[i - 1], observed: observed[j - 1] });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      result.push({ status: "deletion", reference: reference[i - 1], observed: null });
      i -= 1;
      continue;
    }
    result.push({ status: "insertion", reference: null, observed: observed[j - 1] });
    j -= 1;
  }
  return result.reverse();
}

export function parsePronunciationReference(text: string): PronunciationUnit[] {
  const units: PronunciationUnit[] = [];
  let current: PronunciationUnit | null = null;
  let index = 0;

  for (const char of text.normalize("NFC")) {
    if (/^[\u064B-\u0652\u0670]$/.test(char)) {
      if (current) current.marks.push(HARAKA_NAMES[char] || char);
      continue;
    }
    if (/^[\u0621-\u064A]$/.test(char)) {
      current = { letter: char, marks: [], index };
      units.push(current);
      index += 1;
      continue;
    }
    current = null;
  }
  return units;
}

export function compareHumanPronunciation(referenceText: string, observedText: string) {
  const reference = parsePronunciationReference(referenceText);
  const observed = parsePronunciationReference(observedText);
  const errorTypes = new Set<string>();
  const max = Math.max(reference.length, observed.length);

  for (let i = 0; i < max; i += 1) {
    const expected = reference[i];
    const actual = observed[i];
    if (!expected && actual) {
      errorTypes.add("letter_insertion");
      continue;
    }
    if (expected && !actual) {
      errorTypes.add("letter_deletion");
      continue;
    }
    if (!expected || !actual) continue;
    if (stripDiacritics(expected.letter) !== stripDiacritics(actual.letter)) errorTypes.add("letter_substitution");
    const expectedMarks = expected.marks.join("|");
    const actualMarks = actual.marks.join("|");
    if (expectedMarks !== actualMarks) {
      if (expected.marks.includes("شدة") || actual.marks.includes("شدة")) errorTypes.add("shadda_mismatch");
      if (expected.marks.includes("سكون") || actual.marks.includes("سكون")) errorTypes.add("sukun_mismatch");
      if (expected.marks.some((mark) => mark.startsWith("تنوين")) || actual.marks.some((mark) => mark.startsWith("تنوين"))) errorTypes.add("tanween_mismatch");
      if (expected.marks.some((mark) => ["فتحة", "كسرة", "ضمة"].includes(mark)) || actual.marks.some((mark) => ["فتحة", "كسرة", "ضمة"].includes(mark))) errorTypes.add("haraka_mismatch");
    }
  }

  return { observedUnits: observed, errorTypes: Array.from(errorTypes) };
}

export function analyzeReading(referenceText: string, transcript: string | null) {
  const normalizedReference = normalizeArabic(referenceText);
  const pronunciationReference = parsePronunciationReference(referenceText);
  if (!transcript?.trim()) {
    return {
      normalizedReference,
      normalizedTranscript: null,
      alignment: [] as AlignmentUnit[],
      correct: null,
      deletion: null,
      insertion: null,
      substitution: null,
      wer: null,
      lexicalAccuracy: null,
      pronunciationReference,
    };
  }

  const normalizedTranscript = normalizeArabic(transcript);
  const alignment = alignWords(referenceText, transcript);
  const correct = alignment.filter((item) => item.status === "correct").length;
  const deletion = alignment.filter((item) => item.status === "deletion").length;
  const insertion = alignment.filter((item) => item.status === "insertion").length;
  const substitution = alignment.filter((item) => item.status === "substitution").length;
  const referenceCount = Math.max(1, tokens(referenceText).length);
  const errors = deletion + insertion + substitution;
  const wer = errors / referenceCount;
  const lexicalAccuracy = Math.max(0, 1 - wer);

  return {
    normalizedReference,
    normalizedTranscript,
    alignment,
    correct,
    deletion,
    insertion,
    substitution,
    wer,
    lexicalAccuracy,
    pronunciationReference,
  };
}
