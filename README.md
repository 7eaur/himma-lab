# Himma Calibration Lab

مختبر مستقل لجمع بيانات النطق العربية ومعايرة محرك التحليل الصوتي لمنصة هِمّة.

## الهدف

- جمع تسجيلات لأهداف عربية معروفة مسبقًا.
- حفظ نتيجة Azure Speech كدليل تقني فقط.
- إضافة Ground Truth بشري مفصل للصحيح والخطأ.
- فصل بيانات المختبر تمامًا عن قاعدة منصة هِمّة الإنتاجية.
- تجهيز Dataset قابلة لاحقًا للمعايرة وقياس confusion matrix وfalse accept / false reject.

## المكدس

- Next.js + TypeScript
- Supabase PostgreSQL + Storage
- Azure Speech عبر API server-side فقط
- Vercel للنشر المقترح

## الخصوصية

لا تُخزن أسماء طلاب أو بيانات تعريفية مباشرة. المشاركون يستخدمون رموزًا مجهولة، ولا يوضع أي مفتاح Azure أو Supabase service role داخل Git.

## الحالة

النسخة الأولى قيد البناء: Participant flow + recording + annotation + dashboard + calibration schema.


## Simplified Speech Experiment

The branch `experiment/simplified-speech-lab-20260921` adds a direct experiment surface at `/speech-test`.

It intentionally uses three modes only:

- `targeted_pronunciation`: short-vowel, shadda, sukun, and madd targets. Azure lexical ASR is shown as evidence and Azure Pronunciation Assessment is requested from the same Speech resource.
- `lexical`: sentences/passages are normalized without Arabic diacritics and aligned as C/D/I/S.
- `fluency`: lexical evidence plus captured duration; final fluency thresholds are intentionally not invented yet.

Every experiment stores the machine evidence in `speech_experiment_runs` and lets the evaluator record whether the spoken attempt was actually correct, incorrect, or unclear. Experiment decisions have `academic_effect = none`.

Provider readiness is exposed by `/api/speech-test/status`. The pronunciation region is inferred from a standard regional `HIMMA_AZURE_SPEECH_ENDPOINT`, or can be supplied explicitly through `HIMMA_AZURE_SPEECH_REGION` / `HIMMA_AZURE_PRONUNCIATION_ENDPOINT`.

Do not promote experiment thresholds into the student academic path until representative recordings have been reviewed and the decision policy is explicitly approved.
