import Link from "next/link";
import { AudioLines, BarChart3, Database, Mic2, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="shell">
      <div className="container">
        <header className="topbar">
          <div className="brand"><span className="brand-mark"><AudioLines size={22} /></span><span>مختبر هِمّة للمعايرة</span></div>
          <nav className="nav-links" aria-label="التنقل الرئيسي">
            <Link className="nav-link" href="/lab">بدء التسجيل</Link>
            <Link className="nav-link" href="/admin">لوحة البيانات</Link>
          </nav>
        </header>

        <section className="hero">
          <div>
            <p className="eyebrow">HIMMA CALIBRATION LAB</p>
            <h1>نجمع الدليل الصوتي قبل أن نحكم على النطق.</h1>
            <p className="lead">مختبر مستقل لتسجيل أهداف عربية معروفة مسبقًا، حفظ نتيجة Azure كدليل تقني، ثم إضافة الحكم البشري الذي يصبح أساس Dataset المعايرة.</p>
            <div className="actions">
              <Link className="btn btn-primary" href="/lab"><Mic2 size={19} /> ابدأ جلسة تسجيل</Link>
              <Link className="btn btn-secondary" href="/admin"><BarChart3 size={19} /> لوحة المشرف</Link>
            </div>
          </div>
          <div className="card hero-card">
            <div>
              <span className="badge">مثال هدف معايرة</span>
              <div className="target-sample">بَ</div>
            </div>
            <div>
              <p className="muted">المطلوب ليس فقط «صحيح/خطأ». عند الخطأ نسجل ما سُمِع فعليًا مثل بِ أو بُ أو بْ، ثم نقارن الحكم البشري بنتيجة المزوّد.</p>
              <div className="contrasts"><span className="contrast">بِ</span><span className="contrast">بُ</span><span className="contrast">بْ</span></div>
            </div>
          </div>
        </section>

        <section className="feature-grid" aria-label="خصائص المختبر">
          <article className="feature"><Mic2 size={25} color="var(--teal-dark)" /><h3>تسجيل من المتصفح</h3><p>المشارك يسجل من الهاتف أو الكمبيوتر، يستمع لتسجيله، ثم يرسله دون أدوات إضافية.</p></article>
          <article className="feature"><Database size={25} color="var(--teal-dark)" /><h3>Dataset منفصلة</h3><p>التسجيلات والوسوم ونتائج Azure تبقى بعيدة عن قاعدة منصة هِمّة الإنتاجية.</p></article>
          <article className="feature"><ShieldCheck size={25} color="var(--teal-dark)" /><h3>Ground Truth بشري</h3><p>لا تتحول ثقة Azure إلى درجة. الحكم البشري والاتفاق بين المراجعين هما أساس المعايرة.</p></article>
        </section>
      </div>
    </main>
  );
}
