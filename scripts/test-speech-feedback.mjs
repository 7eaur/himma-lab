import assert from "node:assert/strict";
import { parseSpeechFeedback } from "../lib/speech-feedback.ts";

const identity = {
  participantCode: " HIMMA21 ",
  runId: "57ea9b43-c33e-489c-9083-46971bce9a30",
};
const now = "2026-11-01T00:00:00.000Z";

const providerOnly = parseSpeechFeedback({
  ...identity, providerVerdict: "accurate", providerNotes: "التحليل مطابق للصوت",
}, now);
assert.equal(providerOnly.ok, true);
if (providerOnly.ok) {
  assert.equal(providerOnly.participantCode, "HIMMA21");
  assert.equal(providerOnly.patch.provider_feedback_verdict, "accurate");
  assert.equal(providerOnly.patch.provider_feedback_notes, "التحليل مطابق للصوت");
  assert.equal(Object.hasOwn(providerOnly.patch, "feedback_verdict"), false,
    "Provider-only review must not erase a previous child-verdict");
}

const childOnly = parseSpeechFeedback({ ...identity, verdict: "incorrect", observedText: "مِ" }, now);
assert.equal(childOnly.ok, true);
if (childOnly.ok) {
  assert.equal(childOnly.patch.feedback_verdict, "incorrect");
  assert.equal(childOnly.patch.feedback_observed_text, "مِ");
  assert.equal(Object.hasOwn(childOnly.patch, "provider_feedback_verdict"), false,
    "Child-only review must not erase a previous provider review");
}

const both = parseSpeechFeedback({
  ...identity, verdict: "correct", providerVerdict: "inaccurate",
  providerObservedText: "قِ", providerNotes: "خطأ في التعرف",
}, now);
assert.equal(both.ok, true);
if (both.ok) {
  assert.equal(both.patch.feedback_verdict, "correct");
  assert.equal(both.patch.provider_feedback_verdict, "inaccurate");
  assert.equal(both.patch.provider_feedback_observed_text, "قِ");
}

for (const input of [
  { ...identity },
  { ...identity, verdict: "success" },
  { ...identity, providerVerdict: "correct" },
  { ...identity, providerVerdict: "accurate", providerNotes: "x".repeat(1501) },
  { ...identity, providerVerdict: "accurate", runId: "bogus" },
]) {
  assert.equal(parseSpeechFeedback(input, now).ok, false);
}

console.log("Provider-vs-child independent feedback contract passed.");
