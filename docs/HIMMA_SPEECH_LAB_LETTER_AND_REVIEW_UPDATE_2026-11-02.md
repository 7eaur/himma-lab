# Himma Speech Lab — targeted letter aliases and evidence-first review
Date: 2026-11-02
Status: Experimental Preview only; not approved for student assessment.

## Canonical reference
- Himma V2 voice content commit: 4e6bf86528d17b8a1c81339cbe55634032cec5e3
- V2 corpus remains 62 questions, unchanged.
- This change affects 10 targeted letter cases in the experiment-only alias overlay, plus lab UI and reviewer evidence capture.

## Requested exact alias change
Nine unvowelled bare-letter spellings removed:
- لَ: remove ل
- قِ: remove ق
- بُ: remove ب
- مَ: remove م
- سُ: remove س
- دُ: remove د
- لِ: remove ل
- فِ: remove ف
- قُ: remove ق

Bare-letter ر retained on رَ because user did not request its removal.
Additional Latin hypotheses:
- سُ: So
- دُ: do
- قُ: qo

These hypotheses are CASE-INSENSITIVE for Latin letters and only work as `do_not_fail_from_asr_only`. They do NOT confirm that a child pronounced the correct short vowel, do NOT accept madd, and do NOT confer academic correctness.
Version of experiment-only alias list: 1.1.

## Source-of-truth records per recording
Saved automatically on each successful analysis in `public.speech_experiment_runs`:
- participant_code, source_question_id, content_version, speech_mode, reference_text
- audio_storage_path and technical audio evidence
- asr_transcript, asr_confidence, asr_error, asr_diagnostics
- pronunciation_evidence, alias_evidence (including catalogVersion 1.1)
- reading_analysis, decision_state, decision_reason
- asr_diagnostics.decisionPolicyVersion = lab-v2-20261102
- no academic effect

Three **distinct independent human reviews**, each with separate timestamp/notes:
- `feedback_verdict`: was the CHILD pronunciation correct/incorrect/unclear compared with the target?
- `provider_feedback_verdict`: was the AZURE transcript faithful/incorrect/unclear?
- `model_feedback_verdict`: was the MODEL's recorded decision appropriate/inappropriate/unclear for available evidence?

Provider text correction and child actual pronunciation can each be stored separately. The UI can save one, two, or three reviews without overwriting any other dimension. UI feedback is bound to `result.participantCode` returned from analysis so editing the code field later does not redirect a review.

## UI rules
- Show the target, record/playback/analyze action, ASR transcript, and model decision.
- Clearly identify 'retry_required' as **awaiting review or more evidence**, NOT as student failure.
- Only show an alias hint when there was a matching ASR spelling hypothesis; it is never a correctness verdict.
- For targeted letters do NOT show lexicalAccuracy/WER/C-D-I-S as if they measured harakat.
- Pronunciation Assessment scores, phoneme metrics, lexical alignment and raw JSON are collapsed as researcher-only technical evidence; stored evidence remains untouched.
- Explain that matching word text for longer reading activities does not certify pronunciation of every diacritic.
- Don't show developer reason codes in prominent user-facing text; keep them in raw evidence.
- Do not create simulated approvals; all review fields remain null until human interaction.

## Validation
- Targeted alias contract: nine requested bare spellings removed, additions, cross-vowel and invalid candidates.
- Feedback parser contract: three independent review dimensions, independent patches and invalid values.
- Exact-SHA CI TypeScript / ESLint / Build; Vercel Preview only.
- Human recordings and saved review submissions must be verified in real use before any deployment to Himma V2.
