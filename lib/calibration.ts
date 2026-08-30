import { parsePronunciationReference } from "@/lib/analysis";

export const VALIDITIES = ["valid", "silence", "noisy", "too_short", "unclear", "corrupt"] as const;
export const CONFIDENCES = ["high", "medium", "low"] as const;
export const ERROR_CATEGORIES = ["haraka", "letter", "deletion", "insertion", "shadda", "sukun", "tanween", "unclear", "other"] as const;
export const UNSURE_REASONS = ["cannot_distinguish", "recording_quality", "haraka_uncertain", "letter_uncertain", "other"] as const;
export const UNIT_VERDICTS = ["correct", "incorrect", "unsure"] as const;
export const OBSERVED_MARKS = ["فتحة", "كسرة", "ضمة", "سكون", "تنوين فتح", "تنوين كسر", "تنوين ضم", "بدون حركة", "غير متأكد"] as const;

export type Validity = typeof VALIDITIES[number];
export type Confidence = typeof CONFIDENCES[number];
export type ErrorCategory = typeof ERROR_CATEGORIES[number];
export type UnsureReason = typeof UNSURE_REASONS[number];
export type UnitVerdict = typeof UNIT_VERDICTS[number];

export type UnitAnnotation = {
  index: number;
  expectedLetter: string;
  expectedMarks: string[];
  verdict: UnitVerdict;
  observedLetter: string;
  observedMark: string;
  observedShadda: boolean | null;
  note: string;
};

export const VALIDITY_LABELS: Record<Validity, string> = {
  valid: "صالح وواضح",
  silence: "صمت أو لا يوجد نطق",
  noisy: "ضوضاء تؤثر على السماع",
  too_short: "قصير جدًا أو مبتور",
  unclear: "غير واضح",
  corrupt: "ملف غير صالح",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  haraka: "الحركة مختلفة",
  letter: "حرف مختلف",
  deletion: "حذف حرف أو جزء",
  insertion: "إضافة حرف أو جزء",
  shadda: "خطأ في الشدة",
  sukun: "خطأ في السكون",
  tanween: "خطأ في التنوين",
  unclear: "النطق غير واضح",
  other: "خطأ آخر",
};

export const UNSURE_REASON_LABELS: Record<UnsureReason, string> = {
  cannot_distinguish: "لم أستطع تمييز النطق",
  recording_quality: "جودة التسجيل لا تسمح بالحكم",
  haraka_uncertain: "غير متأكد من الحركة",
  letter_uncertain: "غير متأكد من الحرف",
  other: "سبب آخر",
};

const markToChar: Record<string, string> = {
  "فتحة": "َ",
  "كسرة": "ِ",
  "ضمة": "ُ",
  "سكون": "ْ",
  "تنوين فتح": "ً",
  "تنوين كسر": "ٍ",
  "تنوين ضم": "ٌ",
};
const PRIMARY_MARKS = ["فتحة", "كسرة", "ضمة", "سكون", "تنوين فتح", "تنوين كسر", "تنوين ضم"];

export function displayObservedUnit(unit: UnitAnnotation) {
  if (!unit.observedLetter) return "—";
  const mark = markToChar[unit.observedMark] || "";
  const shadda = unit.observedShadda ? "ّ" : "";
  return `${unit.observedLetter}${shadda}${mark}`;
}

export function createUnitAnnotations(text: string): UnitAnnotation[] {
  return parsePronunciationReference(text).map((unit) => ({
    index: unit.index,
    expectedLetter: unit.letter,
    expectedMarks: unit.marks,
    verdict: "correct",
    observedLetter: unit.letter,
    observedMark: unit.marks.find((mark) => PRIMARY_MARKS.includes(mark)) || "بدون حركة",
    observedShadda: unit.marks.includes("شدة"),
    note: "",
  }));
}

export function supportsDetailedUnits(targetType: string) {
  return ["letter", "letter_with_haraka", "syllable", "word"].includes(targetType);
}

export function sanitizeUnitAnnotations(value: unknown): UnitAnnotation[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const verdict = String(row.verdict || "");
    if (!UNIT_VERDICTS.includes(verdict as UnitVerdict)) return [];
    const expectedLetter = String(row.expectedLetter || "").slice(0, 4);
    const observedLetter = String(row.observedLetter || "").slice(0, 4);
    const observedMark = String(row.observedMark || "").slice(0, 30);
    const expectedMarks = Array.isArray(row.expectedMarks) ? row.expectedMarks.filter((mark): mark is string => typeof mark === "string").slice(0, 5) : [];
    return [{
      index: Number.isFinite(Number(row.index)) ? Number(row.index) : 0,
      expectedLetter,
      expectedMarks,
      verdict: verdict as UnitVerdict,
      observedLetter,
      observedMark,
      observedShadda: typeof row.observedShadda === "boolean" ? row.observedShadda : null,
      note: String(row.note || "").slice(0, 200),
    }];
  });
}

export function unitAnnotationErrorTypes(units: UnitAnnotation[]) {
  const errors = new Set<string>();
  for (const unit of units) {
    if (unit.verdict !== "incorrect") continue;
    if (!unit.observedLetter) errors.add("letter_deletion");
    else if (unit.observedLetter !== unit.expectedLetter) errors.add("letter_substitution");

    const expectedPrimary = unit.expectedMarks.find((mark) => PRIMARY_MARKS.includes(mark)) || "بدون حركة";
    const observedPrimary = unit.observedMark || "غير متأكد";
    if (observedPrimary !== "غير متأكد" && expectedPrimary !== observedPrimary) {
      if (expectedPrimary.startsWith("تنوين") || observedPrimary.startsWith("تنوين")) errors.add("tanween_mismatch");
      else if (expectedPrimary === "سكون" || observedPrimary === "سكون") errors.add("sukun_mismatch");
      else errors.add("haraka_mismatch");
    }
    if (unit.expectedMarks.includes("شدة") !== Boolean(unit.observedShadda)) errors.add("shadda_mismatch");
  }
  return Array.from(errors);
}
