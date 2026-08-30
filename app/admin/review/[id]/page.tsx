import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ShieldCheck, Activity, Headphones } from "lucide-react";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase";
import { findTarget } from "@/lib/targets";
import { ReviewForm } from "@/components/review-form";
import {
  CONFIDENCE_LABELS,
  ERROR_CATEGORY_LABELS,
  UNSURE_REASON_LABELS,
  VALIDITY_LABELS,
  type Confidence,
  type ErrorCategory,
  type UnsureReason,
  type Validity,
} from "@/lib/calibration";

export const dynamic = "force-dynamic";

const verdictLabel: Record<string, string> = { correct: "صحيح", incorrect: "خطأ", unsure: "غير متأكد", invalid: "غير صالح" };
const qualityLabel: Record<string, string> = { good: "واضح", noisy: "ضوضاء", too_short: "قصير", silence: "صمت", unclear: "غير واضح", corrupt: "تالف" };
const percent = (value: unknown) => value == null ? "—" : `${Math.round(Number(value) * 100)}%`;
const validityLabel = (value: unknown) => VALIDITY_LABELS[String(value || "valid") as Validity] || String(value || "—");
const confidenceLabel = (value: unknown) => CONFIDENCE_LABELS[String(value || "medium") as Confidence] || String(value || "—");
const errorCategoryLabel = (value: unknown) => value ? (ERROR_CATEGORY_LABELS[String(value) as ErrorCategory] || String(value)) : "—";
const unsureReasonLabel = (value: unknown) => value ? (UNSURE_REASON_LABELS[String(value) as UnsureReason] || String(value)) : "—";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) redirect("/admin/login");
  const supabase = getSupabaseAdmin();
  if (!supabase) redirect("/admin");
  const { id } = await params;
  const { data: sample } = await supabase.from("calibration_samples").select("*").eq("id", id).maybeSingle();
  if (!sample) notFound();
  const { data: reviews } = await supabase.from("calibration_reviews").select("*").eq("sample_id", id).order("reviewer_slot");
  const { data: signed } = await supabase.storage.from(RECORDINGS_BUCKET).createSignedUrl(sample.storage_path, 60 * 30);
  const target = findTarget(sample.target_key);
  const pronunciationReference = Array.isArray(sample.pronunciation_reference) ? sample.pronunciation_reference : [];
  const alignment = Array.isArray(sample.alignment) ? sample.alignment : [];
  const selfUnits = Array.isArray(sample.self_unit_annotations) ? sample.self_unit_annotations : [];

  return (
    <main className="shell admin-shell"><div className="container lab-wrap">
      <header className="admin-brandbar"><Link className="admin-brand-logo" href="/admin"><Image src="/himma-logo.svg" alt="هِمّة" width={142} height={64} priority /><span>مراجعة تسجيل</span></Link><Link className="btn btn-secondary" href="/admin"><ArrowRight size={17} /> العودة للوحة</Link></header>
      <div className="review-layout">
        <section className="card review-evidence-card">
          <span className="soft-badge"><Headphones size={16} /> الهدف المرجعي</span>
          <div className="target-big"><strong>{sample.target_text}</strong></div>

          <h2>التسجيل</h2>
          {signed?.signedUrl ? <audio controls src={signed.signedUrl} preload="metadata" /> : <div className="status status-error">تعذر إنشاء رابط آمن للتسجيل.</div>}

          <div className="section-heading evidence-title"><div><h2>Ground Truth من المشارك</h2><p className="muted">هذه البيانات منفصلة عن Azure، وتوضح صلاحية التسجيل والحكم وما سمعه الشخص.</p></div><ShieldCheck size={22} /></div>
          <div className="review-summary-grid rich-summary-grid">
            <div><span>صلاحية التسجيل</span><strong>{validityLabel(sample.self_validity)}</strong></div>
            <div><span>حكم المشارك</span><strong>{verdictLabel[sample.self_verdict] || sample.self_verdict}</strong></div>
            <div><span>ما قال إنه نطقه</span><strong>{sample.self_observed_text || "—"}</strong></div>
            <div><span>نوع الخطأ</span><strong>{errorCategoryLabel(sample.self_error_category)}</strong></div>
            <div><span>سبب عدم التأكد</span><strong>{unsureReasonLabel(sample.self_unsure_reason)}</strong></div>
            <div><span>ثقة المشارك</span><strong>{confidenceLabel(sample.self_confidence)}</strong></div>
            <div><span>الجودة القديمة</span><strong>{qualityLabel[sample.self_quality] || sample.self_quality}</strong></div>
            <div><span>المدة</span><strong>{sample.client_duration_ms ? `${(Number(sample.client_duration_ms) / 1000).toFixed(1)} ث` : "—"}</strong></div>
          </div>

          {selfUnits.length > 0 && <div className="saved-unit-annotations"><h3>وسم الوحدات من المشارك</h3><div>{selfUnits.map((unit: { index?: number; expectedLetter?: string; expectedMarks?: string[]; verdict?: string; observedLetter?: string; observedMark?: string; observedShadda?: boolean | null }, index: number) => <div key={`${unit.index ?? index}-${unit.expectedLetter}`} className={`saved-unit saved-unit-${unit.verdict || "unknown"}`}><span>الوحدة {index + 1}</span><strong>{unit.expectedLetter || "—"} {unit.expectedMarks?.join(" + ") || ""}</strong><small>{unit.verdict === "correct" ? "صحيح" : unit.verdict === "unsure" ? "غير متأكد" : `المسموع: ${unit.observedLetter || "—"} ${unit.observedMark || ""}${unit.observedShadda ? " + شدة" : ""}`}</small></div>)}</div></div>}

          <div className="section-heading evidence-title"><div><h2>جودة الصوت التشخيصية</h2><p className="muted">مؤشرات من الإشارة الصوتية نفسها، ولا تُستخدم كدرجة أكاديمية قبل المعايرة.</p></div><Activity size={22} /></div>
          <div className="cdis-grid">
            <div><span>المدة المفكوكة</span><strong>{sample.client_decoded_duration_ms == null ? "—" : `${(Number(sample.client_decoded_duration_ms) / 1000).toFixed(1)} ث`}</strong></div>
            <div><span>RMS</span><strong>{sample.client_rms == null ? "—" : Number(sample.client_rms).toFixed(4)}</strong></div>
            <div><span>Peak</span><strong>{sample.client_peak == null ? "—" : Number(sample.client_peak).toFixed(4)}</strong></div>
            <div><span>نسبة الصمت</span><strong>{percent(sample.client_silence_ratio)}</strong></div>
          </div>

          <div className="section-heading evidence-title"><div><h2>التحليل الآلي</h2><p className="muted">Reference-Guided Arabic Reading Analysis</p></div><Activity size={22} /></div>
          <div className="analysis-transcript"><span>Azure Transcript</span><strong>{sample.asr_transcript || "لم يتعرّف على كلام واضح"}</strong><small>{sample.normalized_transcript ? `بعد التطبيع: ${sample.normalized_transcript}` : ""}</small></div>
          <div className="analysis-metrics"><div><span>الدقة اللفظية</span><strong>{percent(sample.lexical_accuracy)}</strong></div><div><span>WER</span><strong>{percent(sample.wer)}</strong></div><div><span>ثقة Azure</span><strong>{percent(sample.asr_confidence)}</strong></div></div>
          <div className="cdis-grid"><div><span>صحيح</span><strong>{sample.correct_count ?? "—"}</strong></div><div><span>حذف</span><strong>{sample.deletion_count ?? "—"}</strong></div><div><span>إضافة</span><strong>{sample.insertion_count ?? "—"}</strong></div><div><span>استبدال</span><strong>{sample.substitution_count ?? "—"}</strong></div></div>

          {alignment.length > 0 && <div className="alignment-list"><h3>المحاذاة</h3><div>{alignment.map((unit: { status?: string; reference?: string | null; observed?: string | null }, index: number) => <span key={`${index}-${unit.reference}-${unit.observed}`} className={`alignment-chip alignment-${unit.status || "unknown"}`}><b>{unit.reference || "∅"}</b><small>{unit.observed && unit.observed !== unit.reference ? `← ${unit.observed}` : unit.status}</small></span>)}</div></div>}

          <div className="pronunciation-panel">
            <div className="section-heading"><div><h3>المرجع النطقي المشكول</h3><p className="muted">تفكيك الحروف والحركات المتوقع من النص نفسه.</p></div></div>
            <div className="pronunciation-units">{pronunciationReference.length ? pronunciationReference.map((unit: { letter?: string; marks?: string[]; index?: number }, index: number) => <div key={`${unit.index ?? index}-${unit.letter}`}><strong>{unit.letter}</strong><span>{unit.marks?.length ? unit.marks.join(" + ") : "بدون حركة قصيرة"}</span></div>) : <span className="muted">لا توجد وحدات نطقية.</span>}</div>
          </div>

          <div className="calibration-warning"><ShieldCheck size={18} /><div><strong>الحكم الآلي على الحركات غير معاير</strong><p>ثقة Azure وWER لا تتحول إلى درجة فتحة/كسرة/ضمة. Ground Truth التفصيلي في هذه الصفحة هو ما سنستخدمه لبناء المعايرة والتحقق منها.</p></div></div>

          <h2>المراجعات البشرية</h2>
          {(reviews || []).length ? <div className="review-cards">{(reviews || []).map((review) => <article className="review-card" key={review.id}><header><strong>المراجع {review.reviewer_slot}</strong><span>{verdictLabel[review.verdict] || review.verdict}</span></header><dl><div><dt>الصلاحية</dt><dd>{validityLabel(review.validity)}</dd></div><div><dt>المسموع</dt><dd>{review.observed_text || "—"}</dd></div><div><dt>نوع الخطأ</dt><dd>{errorCategoryLabel(review.error_category)}</dd></div><div><dt>سبب عدم التأكد</dt><dd>{unsureReasonLabel(review.unsure_reason)}</dd></div><div><dt>الثقة</dt><dd>{confidenceLabel(review.reviewer_confidence)}</dd></div><div><dt>أنواع الخطأ المستنتجة</dt><dd>{Array.isArray(review.error_types) && review.error_types.length ? review.error_types.join("، ") : "—"}</dd></div></dl></article>)}</div> : <p className="muted">لم يراجعها أحد بعد.</p>}
        </section>
        <ReviewForm sampleId={sample.id} targetText={sample.target_text} targetType={sample.target_type} contrasts={target?.contrasts || []} />
      </div>
    </div></main>
  );
}
