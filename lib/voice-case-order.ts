/**
 * Display-only ordering for the Himma V2 speech lab.
 * Do not reorder the approved content bank or change case IDs/sequence numbers.
 * Two-sentence cases belong to the sentences section.
 */
const READING_SECTIONS = [
  { key: "letters", label: "الحروف", prompts: ["اقرأ الحرف بصوت واضح."] },
  { key: "words", label: "الكلمات", prompts: ["اقرأ الكلمة بصوت واضح."] },
  { key: "sentences", label: "الجمل", prompts: [
    "اقرأ الجملة بصوت واضح.",
    "اقرأ الجملتين بصوت واضح.",
  ] },
  { key: "texts", label: "النصوص", prompts: ["اقرأ النص بصوت واضح."] },
] as const;

type CaseWithPrompt = { prompt: string; sequence: number };

export function groupVoiceCasesForDisplay<T extends CaseWithPrompt>(cases: readonly T[]) {
  const bySequence = [...cases].sort((a, b) => a.sequence - b.sequence);
  const used = new Set<T>();
  const groups = READING_SECTIONS.map((section) => {
    const sectionCases = bySequence.filter((item) =>
      (section.prompts as readonly string[]).includes(item.prompt));
    sectionCases.forEach((item) => used.add(item));
    return { key: section.key, label: section.label, cases: sectionCases };
  });
  const unknown = bySequence.filter((item) => !used.has(item));
  if (unknown.length) groups.push({ key: "other", label: "أنشطة أخرى", cases: unknown });
  return groups.filter((group) => group.cases.length);
}
