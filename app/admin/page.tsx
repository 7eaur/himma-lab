import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Database, Mic2, UsersRound } from "lucide-react";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CreateParticipantCode } from "@/components/create-participant-code";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminRequest())) redirect("/admin/login");
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return <main className="shell"><div className="container lab-wrap"><div className="card"><h1 style={{ fontSize: 38 }}>Supabase غير مهيأ</h1><p className="muted">أضف NEXT_PUBLIC_SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY في متغيرات بيئة الاستضافة ثم أعد النشر.</p></div></div></main>;
  }

  const [{ count: participantsCount }, { count: samplesCount }, { count: reviewsCount }, { data: samples }, { data: participants }] = await Promise.all([
    supabase.from("calibration_participants").select("id", { count: "exact", head: true }),
    supabase.from("calibration_samples").select("id", { count: "exact", head: true }),
    supabase.from("calibration_reviews").select("id", { count: "exact", head: true }),
    supabase.from("calibration_samples").select("id,target_text,target_key,self_verdict,self_observed_text,self_quality,asr_transcript,asr_confidence,asr_error,created_at,participant_id").order("created_at", { ascending: false }).limit(30),
    supabase.from("calibration_participants").select("id,code,label,is_active,created_at").order("created_at", { ascending: false }).limit(30),
  ]);

  return (
    <main className="shell"><div className="container lab-wrap">
      <header className="topbar"><Link className="brand" href="/"><span className="brand-mark"><BarChart3 size={21} /></span><span>لوحة بيانات المعايرة</span></Link><div className="nav-links"><Link className="nav-link" href="/lab">فتح المختبر</Link></div></header>
      <div><p className="eyebrow">CALIBRATION DATASET</p><h1 style={{ fontSize: 44 }}>مراقبة جمع البيانات</h1><p className="lead">راقب التوازن بين الأهداف، عدد المشاركين، نتيجة Azure والوسوم البشرية. هذه البيانات بحثية ولا تؤثر على درجات الطلاب.</p></div>

      <section className="stats">
        <div className="stat"><UsersRound size={21} color="var(--teal-dark)" /><span className="muted">المشاركون</span><strong>{participantsCount ?? 0}</strong></div>
        <div className="stat"><Mic2 size={21} color="var(--teal-dark)" /><span className="muted">التسجيلات</span><strong>{samplesCount ?? 0}</strong></div>
        <div className="stat"><Database size={21} color="var(--teal-dark)" /><span className="muted">المراجعات</span><strong>{reviewsCount ?? 0}</strong></div>
        <div className="stat"><BarChart3 size={21} color="var(--teal-dark)" /><span className="muted">بانتظار مراجعة</span><strong>{Math.max(0, (samplesCount ?? 0) - (reviewsCount ?? 0))}</strong></div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 18, alignItems: "start" }}>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><h2 style={{ margin: 0 }}>آخر التسجيلات</h2><p className="muted">اضغط مراجعة لإضافة Ground Truth مستقل.</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>الهدف</th><th>وسم المشارك</th><th>المسموع</th><th>Azure</th><th>الثقة</th><th>الإجراء</th></tr></thead><tbody>
            {(samples || []).map((sample) => <tr key={sample.id}><td style={{ fontSize: 24, fontWeight: 800 }}>{sample.target_text}</td><td><span className="badge">{sample.self_verdict}</span></td><td>{sample.self_observed_text || "—"}</td><td>{sample.asr_transcript || sample.asr_error || "غير محلل"}</td><td>{sample.asr_confidence == null ? "—" : `${Math.round(Number(sample.asr_confidence) * 100)}%`}</td><td><Link className="btn btn-secondary" href={`/admin/review/${sample.id}`}>مراجعة</Link></td></tr>)}
            {(!samples || samples.length === 0) && <tr><td colSpan={6} className="muted">لا توجد عينات بعد.</td></tr>}
          </tbody></table></div>
        </section>
        <aside style={{ display: "grid", gap: 16 }}>
          <CreateParticipantCode />
          <div className="card"><h3 style={{ marginTop: 0 }}>أكواد المشاركين</h3><div style={{ display: "grid", gap: 8 }}>{(participants || []).map((participant) => <div key={participant.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}><div><strong>{participant.code}</strong><div className="muted" style={{ fontSize: 12 }}>{participant.label || "بدون وصف"}</div></div><span className="badge">{participant.is_active ? "مفعّل" : "موقوف"}</span></div>)}</div></div>
        </aside>
      </div>
    </div></main>
  );
}
