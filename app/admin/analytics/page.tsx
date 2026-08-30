import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Target, ShieldCheck, AudioLines } from "lucide-react";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";
import { TARGETS } from "@/lib/targets";
import { ERROR_CATEGORY_LABELS, UNSURE_REASON_LABELS, VALIDITY_LABELS, type ErrorCategory, type UnsureReason, type Validity } from "@/lib/calibration";

export const dynamic = "force-dynamic";

type UnitRow = { verdict?: string; expectedLetter?: string; expectedMarks?: string[]; observedLetter?: string; observedMark?: string };
type Review = {
  verdict: string;
  observed_text: string | null;
  validity: string | null;
  error_category: string | null;
  unsure_reason: string | null;
  unit_annotations: unknown;
  error_types: unknown;
};
type Sample = {
  id: string;
  target_key: string;
  target_text: string;
  self_verdict: string;
  self_observed_text: string | null;
  self_quality: string;
  self_validity: string | null;
  self_error_category: string | null;
  self_unsure_reason: string | null;
  self_unit_annotations: unknown;
  dataset_split: string | null;
  lexical_accuracy: number | null;
  wer: number | null;
  human_error_types: unknown;
  calibration_reviews: Review[] | null;
};

function asStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function asUnits(value: unknown): UnitRow[] {
  return Array.isArray(value) ? value.filter((item): item is UnitRow => Boolean(item && typeof item === "object")) : [];
}
function bump(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}
function humanLabel(key: string) {
  return ERROR_CATEGORY_LABELS[key as ErrorCategory] || UNSURE_REASON_LABELS[key as UnsureReason] || VALIDITY_LABELS[key as Validity] || key;
}
function collectUnitConfusions(map: Map<string, number>, value: unknown) {
  asUnits(value).forEach((unit) => {
    if (unit.verdict !== "incorrect") return;
    const expectedMark = unit.expectedMarks?.find((mark) => ["فتحة", "كسرة", "ضمة", "سكون"].includes(mark));
    if (expectedMark && unit.observedMark && unit.observedMark !== expectedMark) bump(map, `${expectedMark} ← ${unit.observedMark}`);
    if (unit.expectedLetter && unit.observedLetter && unit.expectedLetter !== unit.observedLetter) bump(map, `${unit.expectedLetter} ← ${unit.observedLetter}`);
  });
}

export default async function AnalyticsPage() {
  if (!(await isAdminRequest())) redirect("/admin/login");
  const supabase = getSupabaseAdmin();
  if (!supabase) redirect("/admin");

  const { data } = await supabase
    .from("calibration_samples")
    .select("id,target_key,target_text,self_verdict,self_observed_text,self_quality,self_validity,self_error_category,self_unsure_reason,self_unit_annotations,dataset_split,lexical_accuracy,wer,human_error_types,calibration_reviews(verdict,observed_text,validity,error_category,unsure_reason,unit_annotations,error_types)")
    .limit(10000);
  const samples = (data || []) as Sample[];

  const targetStats = new Map<string, { total: number; valid: number; correct: number; incorrect: number; unsure: number; reviewed: number }>();
  const errors = new Map<string, number>();
  const errorCategories = new Map<string, number>();
  const unsureReasons = new Map<string, number>();
  const confusions = new Map<string, number>();
  const unitConfusions = new Map<string, number>();
  const validities = new Map<string, number>();
  const splits = new Map<string, number>();
  let doubleReviewed = 0;
  let reviewerAgreement = 0;
  let validSamples = 0;
  let invalidSamples = 0;

  samples.forEach((sample) => {
    const current = targetStats.get(sample.target_key) || { total: 0, valid: 0, correct: 0, incorrect: 0, unsure: 0, reviewed: 0 };
    const validity = sample.self_validity || (sample.self_quality === "good" ? "valid" : sample.self_quality);
    current.total += 1;
    if (validity === "valid") { current.valid += 1; validSamples += 1; } else invalidSamples += 1;
    if (sample.self_verdict === "correct") current.correct += 1;
    if (sample.self_verdict === "incorrect") current.incorrect += 1;
    if (sample.self_verdict === "unsure") current.unsure += 1;
    if (sample.calibration_reviews?.length) current.reviewed += 1;
    targetStats.set(sample.target_key, current);

    bump(validities, validity);
    bump(splits, sample.dataset_split || "unassigned");
    bump(errorCategories, sample.self_error_category);
    bump(unsureReasons, sample.self_unsure_reason);
    asStrings(sample.human_error_types).forEach((error) => bump(errors, error));
    if (sample.self_verdict === "incorrect" && sample.self_observed_text) bump(confusions, `${sample.target_text} ← ${sample.self_observed_text}`);
    collectUnitConfusions(unitConfusions, sample.self_unit_annotations);

    const reviews = sample.calibration_reviews || [];
    reviews.forEach((review) => {
      asStrings(review.error_types).forEach((error) => bump(errors, error));
      bump(errorCategories, review.error_category);
      bump(unsureReasons, review.unsure_reason);
      if (review.verdict === "incorrect" && review.observed_text) bump(confusions, `${sample.target_text} ← ${review.observed_text}`);
      collectUnitConfusions(unitConfusions, review.unit_annotations);
    });
    if (reviews.length >= 2) {
      doubleReviewed += 1;
      const first = `${reviews[0].validity || "valid"}|${reviews[0].verdict}|${reviews[0].observed_text || ""}`;
      const second = `${reviews[1].validity || "valid"}|${reviews[1].verdict}|${reviews[1].observed_text || ""}`;
      if (first === second) reviewerAgreement += 1;
    }
  });

  const covered = TARGETS.filter((target) => (targetStats.get(target.key)?.total || 0) > 0).length;
  const topErrors = Array.from(errors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const topErrorCategories = Array.from(errorCategories.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topUnsureReasons = Array.from(unsureReasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topConfusions = Array.from(confusions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const topUnitConfusions = Array.from(unitConfusions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const agreementRate = doubleReviewed ? reviewerAgreement / doubleReviewed : null;

  return (
    <main className="shell admin-shell"><div className="container lab-wrap">
      <header className="admin-brandbar"><Link className="admin-brand-logo" href="/admin"><Image src="/himma-logo.svg" alt="هِمّة" width={142} height={64} priority /><span>تحليلات المعايرة</span></Link><Link className="btn btn-secondary" href="/admin"><ArrowRight size={17} /> العودة للوحة</Link></header>

      <section className="admin-hero"><div><span className="soft-badge"><BarChart3 size={16} /> جودة Dataset</span><h1>تغطية الأهداف وجودة Ground Truth</h1><p className="lead">نراقب توازن الصحيح والخطأ، صلاحية التسجيلات، مواضع أخطاء الحركات، واتفاق المراجعين قبل استخدام أي عينة في المعايرة.</p></div><div className="coverage-card"><Target size={25} /><strong>{covered} / {TARGETS.length}</strong><span>هدفًا لديه بيانات</span></div></section>

      <section className="stats admin-stats">
        <div className="stat"><AudioLines size={21} /><span className="muted">إجمالي العينات</span><strong>{samples.length}</strong></div>
        <div className="stat"><ShieldCheck size={21} /><span className="muted">عينات صالحة</span><strong>{validSamples}</strong></div>
        <div className="stat"><ShieldCheck size={21} /><span className="muted">غير صالحة/ملتبسة</span><strong>{invalidSamples}</strong></div>
        <div className="stat"><ShieldCheck size={21} /><span className="muted">اتفاق المراجعين</span><strong>{agreementRate == null ? "—" : `${Math.round(agreementRate * 100)}%`}</strong></div>
      </section>

      <section className="card"><div className="section-heading"><div><h2>تغطية كل هدف</h2><p className="muted">لا يكفي كثرة التسجيلات؛ نحتاج عينات صالحة وتوازنًا بين النطق الصحيح والأخطاء المقصودة.</p></div></div><div className="table-wrap"><table><thead><tr><th>المجموعة</th><th>الهدف</th><th>العينات</th><th>صالحة</th><th>صحيح</th><th>خطأ</th><th>غير متأكد</th><th>مراجعة بشرية</th></tr></thead><tbody>{TARGETS.map((target) => { const stat = targetStats.get(target.key) || { total: 0, valid: 0, correct: 0, incorrect: 0, unsure: 0, reviewed: 0 }; return <tr key={target.key}><td>{target.section}</td><td className="target-cell">{target.text}</td><td>{stat.total}</td><td>{stat.valid}</td><td>{stat.correct}</td><td>{stat.incorrect}</td><td>{stat.unsure}</td><td>{stat.reviewed}</td></tr>; })}</tbody></table></div></section>

      <div className="analytics-grid">
        <section className="card"><h2>حالات صلاحية التسجيل</h2><div className="metric-list">{Array.from(validities.entries()).map(([name, count]) => <div key={name}><span>{humanLabel(name)}</span><strong>{count}</strong></div>)}{validities.size === 0 && <p className="muted">لا توجد تسجيلات بعد.</p>}</div></section>
        <section className="card"><h2>فئات الخطأ المختارة بشريًا</h2>{topErrorCategories.length ? <div className="metric-list">{topErrorCategories.map(([name, count]) => <div key={name}><span>{humanLabel(name)}</span><strong>{count}</strong></div>)}</div> : <p className="muted">ستظهر بعد وسم الأخطاء.</p>}</section>
        <section className="card"><h2>أسباب «غير متأكد»</h2>{topUnsureReasons.length ? <div className="metric-list">{topUnsureReasons.map(([name, count]) => <div key={name}><span>{humanLabel(name)}</span><strong>{count}</strong></div>)}</div> : <p className="muted">لا توجد عينات غير مؤكدة بعد.</p>}</section>
        <section className="card"><h2>أخطاء مستنتجة من النص والوحدات</h2>{topErrors.length ? <div className="metric-list">{topErrors.map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div> : <p className="muted">لا توجد أخطاء موسومة بعد.</p>}</section>
        <section className="card"><h2>Confusion على الحركات والحروف</h2>{topUnitConfusions.length ? <div className="metric-list">{topUnitConfusions.map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div> : <p className="muted">ستظهر مثل: فتحة ← ضمة، أو ب ← ت بعد جمع Ground Truth التفصيلي.</p>}</section>
        <section className="card"><h2>أكثر حالات الالتباس للنص الكامل</h2>{topConfusions.length ? <div className="metric-list">{topConfusions.map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div> : <p className="muted">ستظهر هنا أمثلة مثل بِ ← بُ بعد جمع البيانات.</p>}</section>
        <section className="card"><h2>تقسيم Dataset</h2><div className="metric-list">{Array.from(splits.entries()).map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}{splits.size === 0 && <p className="muted">لم يتم تعيين التقسيم بعد.</p>}</div></section>
        <section className="card"><h2>المراجعة المستقلة</h2><div className="metric-list"><div><span>عينات بمراجعتين أو أكثر</span><strong>{doubleReviewed}</strong></div><div><span>اتفاق كامل بين أول مراجعين</span><strong>{reviewerAgreement}</strong></div></div></section>
      </div>
    </div></main>
  );
}
