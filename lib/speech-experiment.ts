import rawContent from "@/data/himma-v2-voice-cases.json";
import { analyzeReading, normalizeArabic } from "@/lib/analysis";

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
  cases: Array<Omit<TestCase, "label" | "mode"> & { speechMode: SpeechMode }>;
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

export const TEST_CASES: TestCase[] = SOURCE.cases.map((item) => ({
  ...item,
  label: `${item.sequence}. ${item.sourceQuestionId}`,
  mode: item.speechMode,
}));

function normalized(value: string) {
  return normalizeArabic(value).toLocaleLowerCase("ar");
}

export function aliasEvidence(transcript: string | null, aliases: string[]) {
  if (!transcript?.trim() || aliases.length === 0) {
    return { matched: false, matchedAlias: null, effect: null };
  }

  const observed = normalized(transcript);
  const matchedAlias = aliases.find((alias) => normalized(alias) === observed) || null;

  return {
    matched: Boolean(matchedAlias),
    matchedAlias,
    effect: matchedAlias ? "do_not_fail_from_asr_only" : null,
  };
}

export function decisionPreview(testCase: TestCase, transcript: string | null) {
  const reading = analyzeReading(testCase.text, transcript);
  const alias = aliasEvidence(transcript, testCase.aliases);

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
