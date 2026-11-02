import assert from "node:assert/strict";
import { parseSpeechFeedback } from "../lib/speech-feedback.ts";

const identity={participantCode:" HIMMA21 ",runId:"57ea9b43-c33e-489c-9083-46971bce9a30"};
const now="2026-11-02T00:00:00.000Z";
const provider=parseSpeechFeedback({...identity,providerVerdict:"accurate",providerNotes:"النص مطابق"},now);
assert.equal(provider.ok,true);
if(provider.ok){
 assert.equal(provider.participantCode,"HIMMA21");
 assert.equal(provider.patch.provider_feedback_verdict,"accurate");
 assert.equal(Object.hasOwn(provider.patch,"feedback_verdict"),false);
 assert.equal(Object.hasOwn(provider.patch,"model_feedback_verdict"),false);
}
const child=parseSpeechFeedback({...identity,verdict:"incorrect",observedText:"مِ"},now);
assert.equal(child.ok,true);
if(child.ok){
 assert.equal(child.patch.feedback_verdict,"incorrect");
 assert.equal(child.patch.feedback_observed_text,"مِ");
 assert.equal(Object.hasOwn(child.patch,"provider_feedback_verdict"),false);
 assert.equal(Object.hasOwn(child.patch,"model_feedback_verdict"),false);
}
const model=parseSpeechFeedback({...identity,modelVerdict:"inappropriate",modelNotes:"إعادة غير لازمة"},now);
assert.equal(model.ok,true);
if(model.ok){
 assert.equal(model.patch.model_feedback_verdict,"inappropriate");
 assert.equal(model.patch.model_feedback_notes,"إعادة غير لازمة");
 assert.equal(Object.hasOwn(model.patch,"feedback_verdict"),false);
 assert.equal(Object.hasOwn(model.patch,"provider_feedback_verdict"),false);
}
const all=parseSpeechFeedback({...identity,verdict:"correct",providerVerdict:"inaccurate",
  providerObservedText:"قِ",providerNotes:"Azure confused haraka",
  modelVerdict:"appropriate",modelNotes:"محافظ"},now);
assert.equal(all.ok,true);
if(all.ok){
 assert.deepEqual([all.patch.feedback_verdict,all.patch.provider_feedback_verdict,all.patch.model_feedback_verdict],
  ["correct","inaccurate","appropriate"]);
}
for(const invalid of [
 {...identity},
 {...identity,verdict:"success"},
 {...identity,providerVerdict:"correct"},
 {...identity,modelVerdict:"wrong"},
 {...identity,providerVerdict:"accurate",providerNotes:"x".repeat(1501)},
 {...identity,modelVerdict:"appropriate",modelNotes:"x".repeat(1501)},
 {...identity,modelVerdict:"appropriate",runId:"bogus"}
]) assert.equal(parseSpeechFeedback(invalid,now).ok,false);
console.log("Three-way independent review contract passed: child/provider/model saved without field overwrites.");
