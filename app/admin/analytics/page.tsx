import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Target, ShieldCheck } from "lucide-react";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";
import { TARGETS } from "@/lib/targets";

export const dynamic = "force-dynamic";

type Review = { verdict: string; observed_text: string | null; error_types: unknown };
type Sample = {
  id: string;
  target_key: string;
  target_text: string;
  self_verdict: string;
  self_observed_text: string | null;
  self_quality: string;
  lexical_accuracy: number | null;
  wer: number | null;
  human_error_types: unknown;
  calibration_reviews: Review[] | null;
};

function asStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function AnalyticsPage() {
  if (!(await isAdminRequest())) redirect("/admin/login");
  const supabase = getSupabaseAdmin();
  if (!supabase) redirect("/admin");

  const { data } = await supabase
    .from("calibration_samples")
    .select("id,target_key,target_text,self_verdict,self_observed_text,self_quality,lexical_accuracy,wer,human_error_types,calibration_reviews(verdict,observed_text,error_types)")
    .limit(10000);
  const samples = (data || []) as Sample[];

  const targetStats = new Map<string, { total: number; correct: number; incorrect: number; reviewed: number }>();
  const errors = new Map<string, number>();
  const confusions = new Map<string, number>();
  const qualities = new Map<string, number>();
  let doubleReviewed = 0;
  let reviewerAgreement = 0;

  samples.forEach((sample) => {
    const current = targetStats.get(sample.target_key) || { total: 0, correct: 0, incorrect: 0, reviewed: 0 };
    current.total += 1;
    if (sample.self_verdict === "correct") current.correct += 1;
    if (sample.self_verdict === "incorrect") current.incorrect += 1;
    if (sample.calibration_reviews?.length) current.reviewed += 1;
    targetStats.set(sample.target_key, current);
    qualities.set(sample.self_quality, (qualities.get(sample.self_quality) || 0) + 1);

    asStrings(sample.human_error_types).forEach((error) => errors.set(error, (errors.get(error) || 0) + 1));
    const reviews = sample.calibration_reviews || [];
    reviews.forEach((review) => {
      asStrings(review.error_types).forEach((error) => errors.set(error, (errors.get(error) || 0) + 1));
      if (review.verdict === "incorrect" && review.observed_text) {
        const key = `${sample.target_text} ← ${review.observed_text}`;
        confusions.set(key, (confusions.get(key) || 0) + 1);
      }
    });
    if (reviews.length >= 2) {
      doubleReviewed += 1;
      const first = `${reviews[0].verdict}|${reviews[0].observed_text || ""}`;
      const second = `${reviews[1].verdict}|${reviews[1].observed_text || ""}`;
      if (first === second) reviewerAgreement += 1;
    }
  });

  const covered = TARGETS.filter((target) => (targetStats.get(target.key)?.total || 0) > 0).length;
  const topErrors = Array.from(errors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const topConfusions = Array.from(confusions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const agreementRate = doubleReviewed ? reviewerAgreement / doubleReviewed : null;

  return (
    <main className="shell admin-shell"><div className="container lab-wrap">
      <header className="admin-brandbar"><Link className="admin-brand-logo" href="/admin"><Image src="/himma-logo.svg" alt="هِمّة" width={142} height={64} priority /><span>تحليلات المعايرة</span></Link><Link className="btn btn-secondary" href="/admin"><ArrowRight size={17} /> العودة للوحة</Link></header>

      <section className="admin-hero"><div><span className="soft-badge"><BarChart3 size={16} /> جودة Dataset</span><h1>تغطية الأهداف والأخطاء</h1><p className="lead">هذه الصفحة تساعدنا على معرفة أين نحتاج تسجيلات إضافية، وما الأخطاء الأكثر تكرارًا، ومدى اتفاق المراجعين قبل اعتماد أي نموذج نطق.</p></div><div className="coverage-card"><Target size={25} /><strong>{covered} / {TARGETS.length}</strong><span>هدفًا لديه بيانات</span></div></section>

      <section className="stats admin-stats">
        <div className="stat"><Target size={21} /><span className="muted">إجمالي الأهداف</span><strong>{TARGETS.length}</strong></div>
        <div className="stat"><BarChart3 size={21} /><span className="muted">العينات</span><strong>{samples.length}</strong></div>
        <div className="stat"><ShieldCheck size={21} /><span className="muted">عينات بمراجعتين</span><strong>{doubleReviewed}</strong></div>
        <div className="stat"><ShieldCheck size={21} /><span className="muted">اتفاق المراجعين</span><strong>{agreementRate == null ? "—" : `${Math.round(agreementRate * 100)}%`}</strong></div>
      </section>

      <section className="card"><div className="section-heading"><div><h2>تغطية كل هدف</h2><p className="muted">نحتاج لاحقًا توازنًا بين الصحيح والأخطاء المقصودة، لا مجرد عدد كبير من التسجيلات الصحيحة.</p></div></div><div className="table-wrap"><table><thead><tr><th>المجموعة</th><th>الهدف</th><th>العينات</th><th>صحيح ذاتيًا</th><th>خطأ ذاتيًا</th><th>تمت مراجعته</th></tr></thead><tbody>{TARGETS.map((target) => { const stat = targetStats.get(target.key) || { total: 0, correct: 0, incorrect: 0, reviewed: 0 }; return <tr key={target.key}><td>{target.section}</td><td className="target-cell">{target.text}</td><td>{stat.total}</td><td>{stat.correct}</td><td>{stat.incorrect}</td><td>{stat.reviewed}</td></tr>; })}</tbody></table></div></section>

      <div className="analytics-grid">
        <section className="card"><h2>أنواع الأخطاء البشرية</h2>{topErrors.length ? <div className="metric-list">{topErrors.map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div> : <p className="muted">لا توجد أخطاء موسومة بعد.</p>}</section>
        <section className="card"><h2>أكثر حالات الالتباس</h2>{topConfusions.length ? <div className="metric-list">{topConfusions.map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div> : <p className="muted">ستظهر هنا أمثلة مثل بَ ← بِ بعد جمع البيانات.</p>}</section>
        <section className="card"><h2>جودة التسجيلات</h2><div className="metric-list">{Array.from(qualities.entries()).map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}{qualities.size === 0 && <p className="muted">لا توجد تسجيلات بعد.</p>}</div></section>
      </div>
    </div></main>
  );
}
