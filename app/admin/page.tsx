import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Database, Mic2, UsersRound, ShieldCheck, Download, Target, Activity } from "lucide-react";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CreateParticipantCode } from "@/components/create-participant-code";
import { TARGETS } from "@/lib/targets";
import { VALIDITY_LABELS, type Validity } from "@/lib/calibration";

export const dynamic = "force-dynamic";

const verdictLabel: Record<string, string> = { correct: "صحيح", incorrect: "خطأ", unsure: "غير متأكد", invalid: "غير صالح" };
const qualityLabel: Record<string, string> = { good: "واضح", noisy: "ضوضاء", too_short: "قصير", silence: "صمت", unclear: "غير واضح", corrupt: "تالف" };
const splitLabel: Record<string, string> = { unassigned: "غير معيّن", development: "Development", calibration: "Calibration", validation: "Validation" };
const validityLabel = (value: unknown) => VALIDITY_LABELS[String(value || "valid") as Validity] || String(value || "—");

export default async function AdminPage() {
  if (!(await isAdminRequest())) redirect("/admin/login");
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return <main className="shell"><div className="container lab-wrap"><div className="card empty-state"><h1>Supabase غير مهيأ</h1><p className="muted">أضف متغيرات Supabase في بيئة الاستضافة ثم أعد النشر.</p></div></div></main>;
  }

  const [{ count: participantsCount }, { count: samplesCount }, { count: reviewsCount }, { data: latestSamples }, { data: participants }, { data: dataset }] = await Promise.all([
    supabase.from("calibration_participants").select("id", { count: "exact", head: true }),
    supabase.from("calibration_samples").select("id", { count: "exact", head: true }),
    supabase.from("calibration_reviews").select("id", { count: "exact", head: true }),
    supabase.from("calibration_samples").select("id,target_text,target_key,target_group,self_verdict,self_observed_text,self_quality,self_validity,self_error_category,self_unsure_reason,dataset_split,asr_transcript,asr_confidence,asr_error,correct_count,deletion_count,insertion_count,substitution_count,wer,lexical_accuracy,calibration_state,created_at,participant_id").order("created_at", { ascending: false }).limit(40),
    supabase.from("calibration_participants").select("id,code,label,is_active,dataset_split,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("calibration_samples").select("target_key,self_verdict,self_quality,self_validity,asr_transcript,wer,lexical_accuracy,calibration_state").limit(5000),
  ]);

  const all = dataset || [];
  const analyzed = all.filter((sample) => sample.asr_transcript).length;
  const validQuality = all.filter((sample) => (sample.self_validity || (sample.self_quality === "good" ? "valid" : sample.self_quality)) === "valid").length;
  const accuracyValues = all.map((sample) => Number(sample.lexical_accuracy)).filter((value) => Number.isFinite(value));
  const werValues = all.map((sample) => Number(sample.wer)).filter((value) => Number.isFinite(value));
  const averageAccuracy = accuracyValues.length ? accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length : null;
  const averageWer = werValues.length ? werValues.reduce((sum, value) => sum + value, 0) / werValues.length : null;
  const counts = new Map<string, number>();
  all.forEach((sample) => counts.set(sample.target_key, (counts.get(sample.target_key) || 0) + 1));
  const coveredTargets = TARGETS.filter((target) => (counts.get(target.key) || 0) > 0).length;

  return (
    <main className="shell admin-shell"><div className="container lab-wrap">
      <header className="admin-brandbar">
        <Link className="admin-brand-logo" href="/admin"><Image src="/himma-logo.svg" alt="هِمّة" width={150} height={68} priority /><span>مختبر القراءة والنطق</span></Link>
        <div className="nav-links"><Link className="nav-link" href="/lab">فتح المختبر</Link><Link className="btn btn-secondary" href="/admin/analytics"><BarChart3 size={17} /> التحليلات</Link><a className="btn btn-secondary" href="/api/admin/export?format=csv"><Download size={17} /> CSV</a><a className="btn btn-secondary" href="/api/admin/export?format=json"><Download size={17} /> JSON</a></div>
      </header>

      <section className="admin-hero">
        <div><span className="soft-badge"><ShieldCheck size={16} /> لوحة المشرف</span><h1>بيانات معايرة النطق</h1><p className="lead">تجمع هذه اللوحة التسجيل الأصلي، Ground Truth البشري، نتيجة Azure، المحاذاة وC/D/I/S وWER والدقة اللفظية، مع فصل بيانات Development وCalibration وValidation.</p></div>
        <div className="coverage-card"><Target size={25} /><strong>{coveredTargets} / {TARGETS.length}</strong><span>هدفًا تم جمع عينة له</span></div>
      </section>

      <section className="stats admin-stats">
        <div className="stat"><UsersRound size={21} /><span className="muted">المشاركون</span><strong>{participantsCount ?? 0}</strong></div>
        <div className="stat"><Mic2 size={21} /><span className="muted">التسجيلات</span><strong>{samplesCount ?? 0}</strong></div>
        <div className="stat"><Database size={21} /><span className="muted">المراجعات</span><strong>{reviewsCount ?? 0}</strong></div>
        <div className="stat"><Activity size={21} /><span className="muted">حللها Azure</span><strong>{analyzed}</strong></div>
        <div className="stat"><ShieldCheck size={21} /><span className="muted">صالحة للحكم</span><strong>{validQuality}</strong></div>
        <div className="stat"><BarChart3 size={21} /><span className="muted">متوسط الدقة اللفظية</span><strong>{averageAccuracy == null ? "—" : `${Math.round(averageAccuracy * 100)}%`}</strong></div>
        <div className="stat"><BarChart3 size={21} /><span className="muted">متوسط WER</span><strong>{averageWer == null ? "—" : `${Math.round(averageWer * 100)}%`}</strong></div>
        <div className="stat"><Target size={21} /><span className="muted">الأهداف المغطاة</span><strong>{coveredTargets}</strong></div>
      </section>

      <div className="admin-grid">
        <section className="card admin-main-card">
          <div className="section-heading"><div><h2>آخر التسجيلات</h2><p className="muted">النتيجة الآلية دليل للمراجعة وليست درجة أكاديمية.</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>الهدف</th><th>Ground Truth</th><th>Azure</th><th>الدقة</th><th>C/D/I/S</th><th>الصلاحية</th><th>المجموعة</th><th>الإجراء</th></tr></thead><tbody>
            {(latestSamples || []).map((sample) => <tr key={sample.id}>
              <td className="target-cell">{sample.target_text}</td>
              <td><span className="badge">{verdictLabel[sample.self_verdict] || sample.self_verdict}</span>{sample.self_observed_text && sample.self_observed_text !== sample.target_text ? <small className="table-note">{sample.self_observed_text}</small> : null}{sample.self_error_category ? <small className="table-note">{sample.self_error_category}</small> : null}</td>
              <td>{sample.asr_transcript || sample.asr_error || "غير محلل"}</td>
              <td>{sample.lexical_accuracy == null ? "—" : `${Math.round(Number(sample.lexical_accuracy) * 100)}%`}</td>
              <td>{sample.correct_count ?? "—"}/{sample.deletion_count ?? "—"}/{sample.insertion_count ?? "—"}/{sample.substitution_count ?? "—"}</td>
              <td>{sample.self_validity ? validityLabel(sample.self_validity) : qualityLabel[sample.self_quality] || sample.self_quality}</td>
              <td><span className="badge">{splitLabel[sample.dataset_split] || sample.dataset_split || "غير معيّن"}</span></td>
              <td><Link className="btn btn-secondary" href={`/admin/review/${sample.id}`}>مراجعة</Link></td>
            </tr>)}
            {(!latestSamples || latestSamples.length === 0) && <tr><td colSpan={8} className="muted">لا توجد عينات بعد. أنشئ كود مشاركة وابدأ أول تسجيل.</td></tr>}
          </tbody></table></div>
        </section>

        <aside className="admin-side">
          <CreateParticipantCode />
          <div className="card"><div className="section-heading"><div><h3>أكواد المشاركين</h3><p className="muted">لا توجد أكواد افتراضية؛ المشرف ينشئها ويحدد مجموعة Dataset لكل متحدث.</p></div></div><div className="participant-list">{(participants || []).map((participant) => <div key={participant.id} className="participant-row"><div><strong>{participant.code}</strong><span>{participant.label || "بدون وصف"}</span><small>{splitLabel[participant.dataset_split] || participant.dataset_split || "غير معيّن"}</small></div><span className="badge">{participant.is_active ? "مفعّل" : "موقوف"}</span></div>)}{(!participants || participants.length === 0) && <div className="empty-mini">لم تُنشئ أي مشارك بعد.</div>}</div></div>
          <div className="card calibration-note"><ShieldCheck size={21} /><div><h3>حالة المعايرة</h3><p>التحليل اللفظي والمحاذاة يعملان. الحكم الآلي على الحركات والشدة والسكون والتنوين يبقى <strong>غير معاير</strong> حتى نجمع ونراجع عينات مستقلة.</p></div></div>
        </aside>
      </div>
    </div></main>
  );
}
