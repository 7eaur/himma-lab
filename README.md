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
