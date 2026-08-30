import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Headphones } from "lucide-react";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase";
import { findTarget } from "@/lib/targets";
import { ReviewForm } from "@/components/review-form";

export const dynamic = "force-dynamic";

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

  return (
    <main className="shell"><div className="container lab-wrap">
      <header className="topbar"><Link className="brand" href="/admin"><span className="brand-mark"><Headphones size={21} /></span><span>مراجعة عينة</span></Link><Link className="btn btn-secondary" href="/admin"><ArrowRight size={17} /> العودة للوحة</Link></header>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,.8fr)", gap: 18, alignItems: "start" }}>
        <section className="card">
          <p className="eyebrow">TARGET</p><div className="target-big"><strong>{sample.target_text}</strong></div>
          <h2>التسجيل</h2>{signed?.signedUrl ? <audio controls src={signed.signedUrl} preload="metadata" /> : <div className="status status-error">تعذر إنشاء رابط آمن للتسجيل.</div>}
          <div className="stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><div className="stat"><span className="muted">حكم المشارك</span><strong style={{ fontSize: 20 }}>{sample.self_verdict}</strong></div><div className="stat"><span className="muted">المسموع عنده</span><strong style={{ fontSize: 20 }}>{sample.self_observed_text || "—"}</strong></div><div className="stat"><span className="muted">الجودة</span><strong style={{ fontSize: 20 }}>{sample.self_quality}</strong></div></div>
          <h2>دليل Azure</h2><div className="card" style={{ boxShadow: "none" }}><p><strong>Transcript:</strong> {sample.asr_transcript || "—"}</p><p><strong>Confidence:</strong> {sample.asr_confidence == null ? "—" : `${Math.round(Number(sample.asr_confidence) * 100)}%`}</p><p><strong>Locale:</strong> {sample.asr_locale || "—"}</p><p><strong>Technical error:</strong> {sample.asr_error || "لا يوجد"}</p><p className="muted">هذه المعلومات دليل تقني فقط وليست درجة نطق.</p></div>
          <h2>المراجعات المحفوظة</h2>{(reviews || []).length ? <div className="table-wrap"><table><thead><tr><th>المراجع</th><th>الحكم</th><th>المسموع</th><th>الجودة</th><th>الثقة</th></tr></thead><tbody>{(reviews || []).map((review) => <tr key={review.id}><td>{review.reviewer_slot}</td><td>{review.verdict}</td><td>{review.observed_text || "—"}</td><td>{review.quality}</td><td>{review.reviewer_confidence}</td></tr>)}</tbody></table></div> : <p className="muted">لم يراجعها أحد بعد.</p>}
        </section>
        <ReviewForm sampleId={sample.id} targetText={sample.target_text} contrasts={target?.contrasts || []} />
      </div>
    </div></main>
  );
}
