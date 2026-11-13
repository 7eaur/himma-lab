<div align="center">

<img src="public/himma-logo.svg" alt="Himma Speech Lab Logo" width="200" />

# مختبر هِمّة للصوت | Himma Speech Lab

**مختبر لجمع تسجيلات النطق العربي ومراجعتها، واختبار التعرّف على الكلام، وتجهيز بيانات تدريب ومعايرة نماذج تقييم النطق.**

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Azure Speech](https://img.shields.io/badge/Azure_Speech-0078D4?style=for-the-badge)](https://azure.microsoft.com/products/ai-services/ai-speech)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

**مشروع تجريبي غير منشور.**

</div>

---

## 📱 Screenshots | صور المشروع

ستُضاف صور واجهات المختبر ولوحة المشرف لاحقًا.

---

## ✨ Key Features | المميزات الرئيسية

- 🎙️ **جمع التسجيلات:** تسجيل قراءة الحروف والكلمات والجمل والنصوص باستخدام أكواد مشاركة.
- 🔎 **تحليل الكلام:** تحويل الصوت إلى نص عبر Azure Speech وجمع أدلة تقييم النطق.
- 🧪 **تجارب صوتية:** اختبار 62 حالة من محتوى هِمّة V2، إلى جانب مسار جمع موسع يضم 90 هدفًا.
- 👂 **مراجعة بشرية مستقلة:** تقييم نطق المشارك ودقة تفريغ المزود وقرار النموذج كلٌّ على حدة.
- 📊 **إدارة العينات:** لوحة للمشرف لمتابعة التسجيلات ومراجعتها وتحليل تغطيتها.
- 📁 **تجهيز بيانات التدريب:** حفظ التسجيلات والأدلة والملاحظات للمعايرة، مع تصدير عينات مسار الجمع إلى CSV أو JSON.
- 🔐 **فصل البيانات:** تخزين خاص للتسجيلات، مستقل عن بيانات الطلاب ودرجاتهم في منصة هِمّة.

---

## 🛠️ Tech Stack | التقنيات

| الجانب | التقنيات |
|---|---|
| **Frontend** | Next.js, React, TypeScript |
| **Backend** | Next.js Route Handlers |
| **Database & Storage** | Supabase PostgreSQL, Supabase Storage |
| **Speech Analysis** | Azure Speech, Pronunciation Assessment |

---

## 📂 Project Structure | هيكل المشروع

```text
himma-lab/
├── app/                   # واجهات المختبر والمشرف ومسارات API
├── components/            # عناصر التسجيل والمراجعة
├── lib/                   # التحليل وجودة الصوت ومنطق التقييم
├── data/                  # حالات القراءة وبدائل التعرّف التجريبية
├── supabase/migrations/   # مخطط البيانات وتحديثاته
├── scripts/               # أدوات التحقق والاختبارات
├── public/                # شعار المشروع
└── docs/PROJECT.md        # الدليل التقني وإعداد البيئة
```

---

## 🚀 Getting Started | التشغيل المحلي

**المتطلبات:** Node.js 22.6 أو أحدث ضمن إصدار مدعوم من Next.js، وnpm، ومشروع Supabase مستقل، ومورد Azure Speech.

```bash
git clone https://github.com/7eaur/himma-lab.git
cd himma-lab
npm install
cp .env.example .env.local
```

اضبط متغيرات البيئة وهيّئ قاعدة المختبر وفق [الدليل التقني](docs/PROJECT.md#التشغيل)، ثم شغّل:

```bash
npm run dev
```

افتح `http://localhost:3000`. تفاصيل التحليل والمعايرة وقاعدة البيانات والبناء موضحة في [دليل المشروع](docs/PROJECT.md).

---

## 👨‍💻 Developer | المطور

**Eng. Elyas Al Shaebi — المهندس إلياس الشعيبي**

📱 **Phone / WhatsApp:** [+967 775 377 979](https://wa.me/967775377979)

[GitHub](https://github.com/7eaur)
