import rawContent from "@/data/himma-v2-voice-cases.json";
import rawLetterAliases from "@/data/himma-v2-targeted-letter-asr-aliases.json";
import { analyzeReading } from "@/lib/analysis";
import { matchTargetedLetterAlias, type LetterAliasCandidate } from "@/lib/targeted-letter-alias";

export type SpeechMode = "targeted_pronunciation" | "lexical" | "fluency";
export type DecisionState = "correct" | "incorrect" | "retry_required";

export type DisplayScoringPolicy = {
  displayDiacriticsPresent: boolean;
  wordIdentityRequired: boolean;
  gradeOnlyExplicitlyIndicatedVowels: boolean;
  allowValidReadingsOfUnvowelledText: boolean;
  doNotPenalizeUnshownCaseEndings: boolean;
  academicAuthority: string;
};

export type TestCase = {
  sequence: number;
  key: string;
  sourceQuestionId: string;
  group: string;
  groupLabel: string;
  ownerId: string | null;
  role: string;
  prompt: string;
  label: string;
  text: string;
  readingReference: string;
  mode: SpeechMode;
  pronunciationAssessment: boolean;
  focus: string | null;
  skillGroup: string | null;
  errorFocus: string | null;
  aliases: string[];
  aliasCandidates: LetterAliasCandidate[];
  displayScoringPolicy: DisplayScoringPolicy;
};

type RawContent = {
  schemaVersion: string;
  contentVersion: string;
  sourceRepository: string;
  sourceBranch: string;
  sourceHead: string;
  sourceContentCommit: string;
  sourceDocument: string;
  academicEffect: "none";
  academicAuthority: "human_supervisor";
  // Alias candidates are an experiment-only overlay and are intentionally
  // absent from the approved Himma V2 62-question content bank.
  cases: Array<Omit<TestCase, "label" | "mode" | "aliasCandidates"> & { speechMode: SpeechMode }>;
};

const SOURCE = rawContent as RawContent;

export const SPEECH_CONTENT_VERSION = SOURCE.contentVersion;
export const SPEECH_SOURCE = {
  repository: SOURCE.sourceRepository,
  branch: SOURCE.sourceBranch,
  head: SOURCE.sourceHead,
  contentCommit: SOURCE.sourceContentCommit,
  document: SOURCE.sourceDocument,
  academicEffect: SOURCE.academicEffect,
  academicAuthority: SOURCE.academicAuthority,
} as const;

const LETTER_ALIAS_CASES = (rawLetterAliases as unknown as {
  cases: Record<string, { reference: string; variants: LetterAliasCandidate[] }>;
}).cases;

export const TEST_CASES: TestCase[] = SOURCE.cases.map((item) => {
  const letterEntry = LETTER_ALIAS_CASES[item.sourceQuestionId];
  return {
    ...item,
    label: `${item.sequence}. ${item.sourceQuestionId}`,
    mode: item.speechMode,
    // Separate experiment-only hypotheses. Never mutate the canonical 62
    // questions or reinterpret these ASR spellings as correct spoken answers.
    aliasCandidates: letterEntry?.reference === item.text ? letterEntry.variants : [],
  };
});

export function decisionPreview(testCase: TestCase, transcript: string | null) {
  const reading = analyzeReading(testCase.text, transcript);
  const alias = matchTargetedLetterAlias(
    testCase.mode === "targeted_pronunciation" ? transcript : null,
    testCase.text,
    testCase.mode === "targeted_pronunciation" ? testCase.aliasCandidates : [],
  );

  if (!transcript?.trim()) {
    return {
      state: "retry_required" as DecisionState,
      reason: "no_transcript",
      reading,
      alias,
    };
  }

  if (testCase.pronunciationAssessment || testCase.mode === "targeted_pronunciation") {
    return {
      state: "retry_required" as DecisionState,
      reason: alias.matched
        ? "asr_alias_requires_pronunciation_evidence"
        : "pronunciation_evidence_required",
      reading,
      alias,
    };
  }

  if (testCase.mode === "lexical") {
    const errors =
      (reading.deletion || 0)
      + (reading.insertion || 0)
      + (reading.substitution || 0);

    if (errors === 0) {
      return {
        state: "correct" as DecisionState,
        reason: "exact_lexical_match",
        reading,
        alias,
      };
    }

    return {
      state: "retry_required" as DecisionState,
      reason: "lexical_mismatch_needs_confirmation",
      reading,
      alias,
    };
  }

  return {
    state: "retry_required" as DecisionState,
    reason: "fluency_policy_pending",
    reading,
    alias,
  };
}
