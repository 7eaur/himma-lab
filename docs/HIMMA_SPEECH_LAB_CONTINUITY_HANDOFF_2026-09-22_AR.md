# HIMMA Speech Lab — Continuity Handoff

التاريخ: 2026-09-22

هذه الوثيقة هي نقطة الاستلام الرسمية لمتابعة تجربة نموذج الصوت المبسط لمنصة هِمّة. لا تعتمد على ذاكرة المحادثات كبديل عنها، ولا تعتبر أي رقم SHA أدناه نهائيًا إذا ظهر Commit أحدث عند الاستلام. ابدأ دائمًا من الحالة الحية.

---

## 1. الهدف الحالي

العمل الحالي ليس دمج نموذج الصوت في Production، وليس اعتماد قرار أكاديمي آلي.

الهدف هو تشغيل **مختبر مستقل فعلي** فوق Azure Speech + Supabase + Vercel لاختبار الهيكل المبسط المتفق عليه، وجمع أدلة حقيقية عن سلوك المزود قبل وضع أي Thresholds أو سياسة نجاح/فشل نهائية.

الهيكل المتفق عليه:

```text
student recording
  ↓
sentence / passage?
  ├─ yes → Azure ASR → normalize → reference-guided alignment → C/D/I/S
  │                                      ↓
  │                         lexical accuracy / retry evidence
  │
  └─ no → targeted letter / diacritized word
           ↓
       Azure ASR + Pronunciation Assessment
           ↓
       alias/confusion evidence
           ↓
   correct / incorrect / retry_required
```

لا Custom ML حاليًا، لا تدريب نموذج من الصفر، لا phoneme database ضخمة، ولا Calibration framework معقد قبل وجود بيانات فعلية.

---

## 2. Source of Truth عند الاستلام

رتب الحقيقة هكذا:

1. Live GitHub branches/commits.
2. Live Vercel preview deployment.
3. Live Supabase schema/data.
4. Executable CI / TypeScript / ESLint / Build.
5. Azure provider behavior من التسجيلات الفعلية.
6. هذه الوثيقة.

إذا تغير HEAD بعد كتابة هذه الوثيقة، اعتمد الأحدث ولا ترجع للخلف.

---

## 3. المستودعات والفروع

### A. المختبر — المستودع الذي يجب العمل عليه الآن

Repository:

`7eaur/himma-lab`

فرع التجربة:

`experiment/simplified-speech-lab-20260921`

HEAD عند كتابة هذه الوثيقة قبل إضافة ملف الـhandoff:

`005c7dc90c07e4dcbda9cc2de19627d90e3e469f`

ملاحظة: إضافة هذه الوثيقة نفسها ستنشئ Commit أحدث؛ لذلك أعد Fetch للفرع أولًا.

`main` في Himma Lab بقي دون دمج التجربة:

`642126d5bb0e60fd18a0f9c196351a6f5a92d14e`

PR التجربة:

`#1 — Experiment: simplified Himma speech decision lab`

الحالة: **Draft / Open / Not merged**.

لا تدمجه إلا بأمر صريح من المستخدم.

### B. منصة هِمّة الأصلية

Repository:

`7eaur/himma-`

فرع نموذج الصوت الأصلي:

`stage/speech-model-completion-20260921`

HEAD الموثق:

`7ce95c7db5fce220aa666349ae1403ab8fd2e001`

الفرع الرسمي الموثق:

`stage/02-content`

HEAD الرسمي:

`4ecb27590f7c19cbe7823804b9919d91000415ef`

**لم يتم دمج فرع نموذج الصوت في الفرع الرسمي، ولم يُطلب ذلك الآن.**

---

## 4. قرار الاستضافة — إلزامي

المستخدم حسم القرار:

**لا تستخدم Railway لهذا المختبر إطلاقًا.**

المكدس المعتمد للمختبر:

- GitHub: `7eaur/himma-lab`
- Vercel: Preview deployment للفرع التجريبي
- Supabase: مشروع `himma-lab`
- Azure Speech: المزود الموجود أصلًا في Himma Lab

لا تنقل المختبر إلى Railway ولا تنشئ Proxy إليه.

تم حذف أي RPCs مؤقتة كانت قد أُنشئت لفكرة Proxy/Railway السابقة. لا تعيدها.

---

## 5. Vercel — الحالة الحالية

Vercel project:

`himma-lab`

Project ID:

`prj_NGvUk0GDppThltTNgsSyECRIr3qp`

Team ID:

`team_GMTdfNaLP5Pp44BeNBPag27t`

الـrate limit الذي كان يمنع Preview انتهى في 2026-09-22، وتم قبول النشر من جديد.

آخر Preview مؤكد READY قبل إضافة ملف الـhandoff:

- Deployment ID: `dpl_8Kv16biN9cbAk3pPJXKjd9auW7FJ`
- Commit: `005c7dc90c07e4dcbda9cc2de19627d90e3e469f`
- Direct deployment URL: `https://himma-qlb3dgkra-wasl15.vercel.app`

Stable branch preview alias:

`https://himma-lab-git-experiment-simplified-speech-lab-20260921-wasl15.vercel.app`

لوحة الاختبار:

`/speech-test`

أي:

`https://himma-lab-git-experiment-simplified-speech-lab-20260921-wasl15.vercel.app/speech-test`

مهم: Preview محمي بـ Vercel Authentication. عند الحاجة استخدم Vercel `get_access_to_vercel_url` للحصول على share URL مؤقت. لا تغيّر إعداد حماية Production فقط لتسهيل الدخول.

بعد أي Commit جديد على الفرع، تحقق أن آخر Preview للـHEAD الجديد أصبح `READY` قبل إعطاء الرابط للمستخدم.

Production في Vercel ما زال من `main` ولم يُستبدل بالتجربة.

---

## 6. Supabase — الحالة الحالية

Supabase project name:

`himma-lab`

Project ID:

`jfvnqbutsyrctjwczday`

المختبر يستخدم Supabase PostgreSQL + Storage الحالية.

تم إنشاء جدول مستقل:

`public.speech_experiment_runs`

وتم تثبيت تعريفه داخل GitHub في:

`supabase/migrations/005_speech_experiment_runs.sql`

الغرض: تخزين دليل كل تجربة بدون خلطه بالمسار الأكاديمي لمنصة هِمّة.

يحتوي على:

- test key / speech mode / pronunciation focus
- reference text
- audio storage metadata
- Azure ASR transcript / confidence / error
- reading analysis JSON
- alias evidence JSON
- pronunciation evidence JSON
- decision state/reason
- evaluator feedback

RLS مفعّل.

كود التجربة الذي تم تجهيزه:

`HIMMA21`

حالته عند آخر تحقق:

- active = true
- dataset_split = `development`

عدد `speech_experiment_runs` عند آخر تحقق قبل بدء الاختبارات الفعلية:

`0`

أي أن Dataset التجربة الجديدة ما زالت نظيفة ولم يبدأ التسجيل عليها بعد.

---

## 7. Azure — القرار الحالي

Himma Lab الحالي يستخدم Azure Speech server-side من Vercel.

المتغيرات الموجودة في التصميم:

- `HIMMA_AZURE_SPEECH_ENDPOINT`
- `HIMMA_AZURE_SPEECH_API_KEY`
- `HIMMA_AZURE_SPEECH_REFERENCE_HINT`
- `HIMMA_AZURE_SPEECH_TIMEOUT_SECONDS`

ولا تعرض قيمة أي Secret في المحادثة أو التوثيق.

لـPronunciation Assessment أضيف دعم:

- `HIMMA_AZURE_SPEECH_REGION` اختياري
- `HIMMA_AZURE_PRONUNCIATION_ENDPOINT` اختياري
- `HIMMA_AZURE_PRONUNCIATION_LOCALE` default=`ar-SA`

الكود يستطيع اشتقاق Azure region تلقائيًا من endpoint إقليمي مثل:

`<region>.api.cognitive.microsoft.com`

لذلك الفكرة هي استخدام **نفس Azure Speech resource والمفتاح الحالي**، وليس مزودًا أو مفتاحًا ثانيًا، إذا كان endpoint بصيغة تسمح باشتقاق المنطقة.

لا تدّعِ أن Azure يميز الحركات/الشدة/السكون/المد بدقة كافية أكاديميًا قبل التجربة الفعلية. هدف المختبر إثبات ذلك أو نفيه بالبيانات.

---

## 8. الهيكل المبسط المعتمد

ثلاثة Modes فقط:

### `targeted_pronunciation`

للحرف أو الكلمة عندما تكون الحركة/الشدة/السكون/المد/هوية الحرف هي الهدف التعليمي.

المسار:

- Azure ASR = دليل لغوي ضعيف/مساعد
- Azure Pronunciation Assessment = دليل نطق إضافي
- tiny alias evidence = لتجنب False Negative من ASR وحده
- لا Threshold نهائي مخترع حتى الآن

### `lexical`

للجمل والنصوص العامة.

المسار:

1. Azure ASR
2. Arabic normalization وإزالة أثر التشكيل للمقارنة اللفظية العامة
3. reference-guided word alignment
4. C/D/I/S
5. WER / lexical accuracy

المبدأ المهم: الجملة أو النص العادي لا يُفشل الطالب لأن ASR لم يثبت كل حركة قصيرة.

### `fluency`

Lexical evidence + duration.

لا يوجد threshold نهائي للطلاقة حتى الآن. لا تخترعه بدون أدلة.

---

## 9. حالات القرار الحالية

الحالات فقط:

- `correct`
- `incorrect`
- `retry_required`

السياسة الحالية المحافظة:

### Lexical

- exact normalized lexical match → `correct`
- أول mismatch C/D/I/S → `retry_required`
- لا يتحول mismatch تلقائيًا إلى `incorrect` من محاولة واحدة
- تأكيد الخطأ بعد تكرار نفس mismatch ما زال يحتاج wiring مع attempt history

### Targeted Pronunciation

حاليًا لا يعطي الكود `correct/incorrect` آليًا بناء على Pronunciation score، لأننا لم نثبت thresholds من بيانات فعلية.

لذلك النتيجة عادة `retry_required` مع سبب يوضح أن Pronunciation evidence مطلوب أو أن alias منع الرفض من ASR وحده.

### Fluency

حاليًا `retry_required` مع policy pending حتى يتم تحديد سياسة مدعومة بالبيانات.

**لا تحول هذه الحالات إلى أثر أكاديمي الآن.**

جميع نتائج المختبر لها:

`academicEffect = none`

---

## 10. Alias policy

الـAlias ليس مساواة لغوية، ولا يعني أن تهجئة Azure البديلة صحيحة أكاديميًا.

أمثلة seed في المختبر:

- `مَ` قد يظهر من ASR كـ `م`, `ما`, `ماء`, `ma`
- `مِ` قد يظهر `م`, `مي`, `mi`
- `مُ` قد يظهر `م`, `مو`, `mu`
- أمثلة مماثلة لـ `بَ / بِ / بُ`

Effect الوحيد:

`do_not_fail_from_asr_only`

أي: إذا رجع ASR alias محتمل، لا تحكم بالخطأ من ASR وحده؛ انتقل لدليل النطق.

هذه aliases seed وليست corpus نهائيًا. عدلها/احذفها فقط بناء على سلوك Azure الحقيقي الذي نراه في التجارب.

---

## 11. لوحة الاختبار الجديدة

Route:

`/speech-test`

الصفحة:

`app/speech-test/page.tsx`

CSS:

`app/speech-test/speech-test.module.css`

مزاياها:

- اختيار حالة الاختبار
- تسجيل من الميكروفون
- PCM WAV mono 16k
- تشغيل التسجيل قبل الإرسال
- إعادة التسجيل
- تحليل مباشر
- عرض Azure ASR transcript/confidence
- عرض normalized reference/transcript
- C/D/I/S + WER + lexical accuracy
- alias evidence
- Azure Pronunciation Assessment للحالات targeted
- Accuracy / Fluency / Completeness / Pronunciation scores
- word/phoneme evidence عند توفره
- القرار الحالي وreason
- raw JSON evidence
- تقييم بشري مباشر من المستخدم:
  - النطق صحيح
  - النطق خطأ
  - غير واضح
  - ماذا سمع؟
  - ملاحظات
- حفظ التقييم في `speech_experiment_runs`

الـPCM recorder:

`lib/pcm-wav-recorder.ts`

---

## 12. APIs المضافة

### `GET /api/speech-test/cases`

يعرض حالات الاختبار المعرفة في:

`lib/speech-experiment.ts`

### `GET /api/speech-test/status`

يعرض فقط readiness بدون كشف Secrets:

- lexical Azure ASR configured?
- Pronunciation configured?
- Supabase storage configured?
- academicEffect = none

### `POST /api/speech-test/analyze`

المسار الكامل:

- يتحقق من participant code
- يخزن WAV في Supabase Storage
- يشغل Azure lexical ASR
- يحسب simplified decision preview
- للحالات targeted يشغل Pronunciation Assessment
- يحفظ الأدلة في `speech_experiment_runs`

### `POST /api/speech-test/feedback`

يحفظ تقييم المستخدم للنتيجة.

---

## 13. أهم ملفات التجربة

- `app/speech-test/page.tsx`
- `app/speech-test/speech-test.module.css`
- `app/api/speech-test/analyze/route.ts`
- `app/api/speech-test/feedback/route.ts`
- `app/api/speech-test/cases/route.ts`
- `app/api/speech-test/status/route.ts`
- `lib/speech-experiment.ts`
- `lib/azure-pronunciation.ts`
- `lib/pcm-wav-recorder.ts`
- `supabase/migrations/005_speech_experiment_runs.sql`
- `.env.example`
- `README.md`
- هذه الوثيقة

---

## 14. Test cases الحالية

Targeted pronunciation تشمل أمثلة مثل:

- `مَ`
- `مِ`
- `مُ`
- `بَ`
- `بِ`
- `بُ`
- `شَمْس` — سكون
- `قِطَّة` — شدة
- `بَاب` — مد

Lexical:

- جمل قصيرة
- نص قصير قليل التشكيل

Fluency:

- نص قصير مخصص لقياس الزمن + lexical evidence

هذه حالات مختبر وليست تعديلًا للمحتوى الرسمي لمنصة هِمّة.

---

## 15. CI / Build

قبل إعادة فتح Vercel rate limit، تم إصلاح خطأ TypeScript في `lib/speech-experiment.ts`.

CI المؤكد الأخضر على:

`bbdb178bbef0fa48116d1d1689a489cf4d23f946`

وقد مر عبر:

- TypeScript
- ESLint
- Build

بعدها أضيف Commit لإعادة تحفيز Vercel، ثم migration 005، وهذه الوثيقة. لذلك عند الاستلام:

1. Fetch HEAD الجديد.
2. تحقق من GitHub Actions على **HEAD الحالي**.
3. لا تعتمد فقط على نجاح `bbdb178...` التاريخي.
4. إذا ظهر فشل جديد أصلحه قبل تجربة المستخدم.

---

## 16. ما تم التحقق منه فعليًا وما لم يتم

### تم

- الفرع المستقل موجود.
- `main` غير مدموج بالتجربة.
- Draft PR #1 موجود.
- Vercel rate limit انتهى.
- Preview deployment عاد يعمل وأصبح READY.
- Supabase table موجود.
- migration 005 موثقة في repo.
- `HIMMA21` active في development split.
- اللوحة والـAPIs والكود موجودة.
- CI كان أخضر بعد إصلاح TypeScript الأساسي.

### لم يتم بعد

- لم يبدأ Dataset التجربة الجديدة فعليًا (`speech_experiment_runs` كان 0 rows عند آخر تحقق).
- لم نثبت من تسجيلات حقيقية كيف يتعامل Azure مع `مَ / مِ / مُ` والشدة والسكون والمد في هذا المسار الجديد.
- لم نعتمد threshold لـPronunciation score.
- لم نوصل repeated lexical mismatch تلقائيًا بمحاولات سابقة لإصدار `incorrect`.
- لم نحدد policy نهائية للطلاقة.
- لم يتم دمج أي شيء إلى `himma-lab/main`.
- لم يتم دمج شيء إلى `himma-/stage/02-content`.
- لا يوجد Academic automation معتمد بعد.

---

## 17. الخطوات التالية للمحادثة الجديدة

نفذ بهذا الترتيب ولا تعيد المشروع من الصفر:

1. Fetch HEAD الحي للفرع `experiment/simplified-speech-lab-20260921`.
2. تحقق من آخر GitHub Actions exact-SHA.
3. تحقق من آخر Vercel Preview للـHEAD نفسه وأنه `READY`.
4. افتح `/api/speech-test/status` وتأكد أن:
   - Storage ready
   - Azure lexical ASR ready
   - Azure Pronunciation ready للحالات targeted
5. إذا Preview محمي، استخدم Vercel share URL مؤقت؛ لا تغير Production protection.
6. افتح `/speech-test` فعليًا وراجع الواجهة على الهاتف والديسكتوب.
7. ابدأ التجارب الفعلية من الحالات القصيرة:
   - `مَ`
   - `مِ`
   - `مُ`
   - `بَ / بِ / بُ`
   - شدة / سكون / مد
8. بعد كل محاولة، اقرأ من Supabase:
   - transcript
   - confidence
   - alias
   - Pronunciation scores
   - word/phoneme evidence
   - evaluator feedback
9. قارن النتيجة بما قال المستخدم إنه نطق فعلًا.
10. ابنِ Matrix صغيرة للـfalse accept / false reject / retry.
11. عدل aliases أو decision policy فقط إذا دعمت البيانات ذلك.
12. بعد targeted pronunciation انتقل للجمل والنصوص، ثم fluency.
13. لا تضع thresholds عشوائية.
14. لا تدمج PR #1 حتى يطلب المستخدم صراحة بعد اكتمال التجارب.

---

## 18. قواعد صارمة للمحادثة الجديدة

- لا Railway للمختبر.
- لا Production edits.
- لا Merge الآن.
- لا Fake ASR.
- لا Temporary Audio Skip.
- لا Student Audio Skip.
- لا automatic level drop.
- لا ادعاء أن Azure أثبت التمييز الدقيق للحركات قبل وجود بيانات.
- لا expose لأي Secret.
- لا تعتبر aliases إجابات صحيحة.
- لا تجعل Pronunciation score حكمًا أكاديميًا دون evidence + policy معتمدة.
- الجمل والنصوص قليلة التشكيل يجب أن تعتمد lexical comparison لا فحص كل حركة.
- Source of Truth الحالي في منصة هِمّة الأصلية يبقى Human Supervisor Review إلى أن يتم اعتماد تغيير رسمي لاحقًا.

---

## 19. هدف مرحلة التجربة الحالية

نريد في النهاية إجابة عملية على الأسئلة التالية، بالبيانات لا بالتخمين:

1. ماذا يرجع Azure ASR فعليًا للحركات القصيرة مثل `مَ / مِ / مُ`؟
2. هل Pronunciation Assessment يعطي signal ثابتًا يمكن الاعتماد عليه للحركات؟
3. كيف يتصرف مع الشدة والسكون والمد؟
4. ما الحالات التي تحتاج Alias فقط لمنع False Negative؟
5. متى يكون `retry_required` أفضل من `incorrect`؟
6. ما thresholds التي يمكن الدفاع عنها علميًا — إن وُجدت؟
7. هل الجمل والنصوص الأقل تشكيلًا تعمل جيدًا عبر ASR + C/D/I/S؟
8. ما سياسة الطلاقة المناسبة بعد رؤية الدقة والزمن الحقيقيين؟

لا تنتقل من التجربة إلى الإنتاج قبل وجود إجابات واضحة لهذه النقاط.
