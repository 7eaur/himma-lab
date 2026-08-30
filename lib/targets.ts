export type TargetType = "letter_with_haraka" | "word" | "sentence";

export type CalibrationTarget = {
  key: string;
  text: string;
  type: TargetType;
  group: string;
  label: string;
  contrasts: string[];
};

export const TARGETS: CalibrationTarget[] = [
  { key: "ba-fatha", text: "بَ", type: "letter_with_haraka", group: "ba-vowels", label: "باء مع فتحة", contrasts: ["بِ", "بُ", "بْ"] },
  { key: "ba-kasra", text: "بِ", type: "letter_with_haraka", group: "ba-vowels", label: "باء مع كسرة", contrasts: ["بَ", "بُ", "بْ"] },
  { key: "ba-damma", text: "بُ", type: "letter_with_haraka", group: "ba-vowels", label: "باء مع ضمة", contrasts: ["بَ", "بِ", "بْ"] },
  { key: "ba-sukun", text: "بْ", type: "letter_with_haraka", group: "ba-vowels", label: "باء مع سكون", contrasts: ["بَ", "بِ", "بُ"] },
  { key: "kataba", text: "كَتَبَ", type: "word", group: "kataba-family", label: "كَتَبَ", contrasts: ["كُتِبَ"] },
  { key: "kutiba", text: "كُتِبَ", type: "word", group: "kataba-family", label: "كُتِبَ", contrasts: ["كَتَبَ"] }
];

export function findTarget(key: string) {
  return TARGETS.find((target) => target.key === key) ?? null;
}
