# Himma Speech Lab — ASR hardening 2026-09-24

## سبب التعديل

أظهرت التسجيلات الفعلية أن بعض طلبات Azure تنجح HTTP لكن:
- تعيد Transcript بحروف لاتينية أو غير عربية رغم أن المرجع عربي.
- تعيد أحيانًا نتيجة بلا Transcript وبلا خطأ واضح.
- تتأثر بعض المحاولات بإشارة صوت منخفضة أو صمت طويل.

هذه الحالات لا يجوز إدخالها مباشرة في C/D/I/S وكأنها قراءة عربية صالحة.

## ما تغير

1. أضيف فحص تقني محلي لملف WAV قبل الإرسال:
   - PCM 16-bit mono.
   - مدة التسجيل.
   - RMS.
   - Peak.
   - Silence ratio.
   - الحالات blocking فقط: ملف غير صالح، صمت فعلي، أو تسجيل قصير جدًا.
   - التحذيرات الأخرى لا تحمل أي أثر أكاديمي.

2. أصبح مسار ASR الأساسي للتسجيلات القصيرة هو Azure Short Audio REST مع language=ar-OM وformat=detailed.
   - هذا المسار يعيد RecognitionStatus صريحًا مثل Success / NoMatch / InitialSilenceTimeout / BabbleTimeout.
   - نفس Azure Speech resource والمفتاح الحاليان مستخدمان.
   - لا Secrets في السجلات أو الواجهة.

3. بقي Fast Transcription كـ fallback تشخيصي عند تعذر المسار القصير أو عدم إعطائه Transcript صالحًا.

4. للجمل والنصوص:
   - إذا كان المرجع عربيًا وأعاد المزود Transcript غير عربي، تحفظ النتيجة كدليل خام.
   - لكنها لا تدخل في normalize أو C/D/I/S.
   - القرار يبقى retry_required.

5. للنطق المستهدف:
   - يسمح بالتهجئات اللاتينية القصيرة كدليل Alias فقط، لأن أمثلة مثل ma / mi / mu قد تكون مفيدة لمنع False Reject.
   - Alias لا يعني correct.

6. أضيف إلى speech_experiment_runs:
   - audio_quality
   - asr_diagnostics

## ما لم يتغير

- لا Pronunciation threshold جديد.
- لا Fluency threshold جديد.
- لا Academic automation.
- academic_effect = none.
- لا Merge إلى main.
- لا تعديل Production.
- لا Railway.

## مرجع المزود

Azure Speech يدعم ar-OM في Speech-to-Text، وواجهة Short Audio تقبل WAV PCM 16k mono وتعيد RecognitionStatus واضحًا. Fast Transcription يبقى متاحًا كمسار fallback فقط في هذا المختبر.
