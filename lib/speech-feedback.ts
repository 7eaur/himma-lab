export type ChildVerdict = "correct" | "incorrect" | "unclear";
export type ProviderVerdict = "accurate" | "inaccurate" | "unclear";
export type ModelDecisionVerdict = "appropriate" | "inappropriate" | "unclear";

export type FeedbackPatch = {
  feedback_verdict?: ChildVerdict;
  feedback_observed_text?: string | null;
  feedback_notes?: string | null;
  feedback_at?: string;
  provider_feedback_verdict?: ProviderVerdict;
  provider_feedback_observed_text?: string | null;
  provider_feedback_notes?: string | null;
  provider_feedback_at?: string;
  model_feedback_verdict?: ModelDecisionVerdict;
  model_feedback_notes?: string | null;
  model_feedback_at?: string;
};

type ValidFeedback = {
  ok: true;
  participantCode: string;
  runId: string;
  patch: FeedbackPatch;
};

type InvalidFeedback = { ok: false; detail: string };

const CHILD_VERDICTS = new Set(["correct", "incorrect", "unclear"]);
const PROVIDER_VERDICTS = new Set(["accurate", "inaccurate", "unclear"]);
const MODEL_VERDICTS = new Set(["appropriate", "inappropriate", "unclear"]);

export function parseSpeechFeedback(input: unknown, savedAt: string): ValidFeedback | InvalidFeedback {
  const body = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};

  const participantCode = typeof body.participantCode === "string" ? body.participantCode.trim().toUpperCase() : "";
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const verdict = body.verdict;
  const providerVerdict = body.providerVerdict;
  const modelVerdict = body.modelVerdict;
  const childGiven = verdict !== undefined && verdict !== null && verdict !== "";
  const providerGiven = providerVerdict !== undefined && providerVerdict !== null && providerVerdict !== "";
  const modelGiven = modelVerdict !== undefined && modelVerdict !== null && modelVerdict !== "";

  if (!participantCode || participantCode.length > 64 || !/^[0-9a-f-]{36}$/i.test(runId)) {
    return { ok: false, detail: "كود التجربة أو معرف التسجيل غير صحيح." };
  }
  if (!childGiven && !providerGiven && !modelGiven) {
    return { ok: false, detail: "اختر تقييم النطق أو تحليل Azure أو قرار النموذج أولًا." };
  }
  if ((childGiven && !CHILD_VERDICTS.has(verdict as string))
    || (providerGiven && !PROVIDER_VERDICTS.has(providerVerdict as string))
    || (modelGiven && !MODEL_VERDICTS.has(modelVerdict as string))) {
    return { ok: false, detail: "خيار التقييم غير معروف." };
  }

  const observedText = typeof body.observedText === "string" ? body.observedText.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const providerObservedText = typeof body.providerObservedText === "string" ? body.providerObservedText.trim() : "";
  const providerNotes = typeof body.providerNotes === "string" ? body.providerNotes.trim() : "";
  const modelNotes = typeof body.modelNotes === "string" ? body.modelNotes.trim() : "";
  if (observedText.length > 500 || notes.length > 1500
    || providerObservedText.length > 500 || providerNotes.length > 1500 || modelNotes.length > 1500) {
    return { ok: false, detail: "الملاحظات طويلة جدًا؛ اختصرها ثم أعد الحفظ." };
  }

  const patch: FeedbackPatch = {};
  if (childGiven) {
    patch.feedback_verdict = verdict as ChildVerdict;
    patch.feedback_observed_text = observedText || null;
    patch.feedback_notes = notes || null;
    patch.feedback_at = savedAt;
  }
  if (providerGiven) {
    patch.provider_feedback_verdict = providerVerdict as ProviderVerdict;
    patch.provider_feedback_observed_text = providerObservedText || null;
    patch.provider_feedback_notes = providerNotes || null;
    patch.provider_feedback_at = savedAt;
  }
  if (modelGiven) {
    patch.model_feedback_verdict = modelVerdict as ModelDecisionVerdict;
    patch.model_feedback_notes = modelNotes || null;
    patch.model_feedback_at = savedAt;
  }
  return { ok: true, participantCode, runId, patch };
}
