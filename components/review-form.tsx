"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

type Props = { sampleId: string; targetText: string; contrasts: string[] };

export function ReviewForm({ sampleId, targetText, contrasts }: Props) {
  const router = useRouter();
  const [verdict, setVerdict] = useState("correct");
  const [observedText, setObservedText] = useState(targetText);
  const [quality, setQuality] = useState("good");
  const [confidence, setConfidence] = useState("high");
  const [notes, setNotes] = useState("");
  const [reviewerSlot, setReviewerSlot] = useState(1);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/review/${sampleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, observedText, quality, confidence, notes, reviewerSlot }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر حفظ المراجعة");
      setMessage("تم حفظ Ground Truth للمراجع.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ المراجعة"); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>الحكم البشري المستقل</h2>
      <p className="muted">استمع للتسجيل أولًا ثم قيّم ما سمعته. لا تنسخ حكم المشارك أو Azure تلقائيًا.</p>
      <label className="label" htmlFor="review-slot">خانة المراجع</label>
      <select id="review-slot" className="select" value={reviewerSlot} onChange={(event) => setReviewerSlot(Number(event.target.value))}><option value={1}>المراجع 1</option><option value={2}>المراجع 2</option><option value={3}>مراجع حاسم</option></select>

      <label className="label">الحكم</label>
      <div className="annotation-grid">
        <button type="button" className={`choice ${verdict === "correct" ? "active" : ""}`} onClick={() => { setVerdict("correct"); setObservedText(targetText); }}>صحيح</button>
        <button type="button" className={`choice ${verdict === "incorrect" ? "active" : ""}`} onClick={() => { setVerdict("incorrect"); setObservedText(""); }}>خطأ</button>
        <button type="button" className={`choice ${verdict === "unsure" ? "active" : ""}`} onClick={() => { setVerdict("unsure"); setObservedText(""); }}>غير متأكد</button>
      </div>

      {verdict === "incorrect" && <div><label className="label">ما الذي سمعته؟</label><div className="contrasts">{contrasts.map((contrast) => <button type="button" key={contrast} className={`contrast ${observedText === contrast ? "active" : ""}`} onClick={() => setObservedText(contrast)}>{contrast}</button>)}</div><input className="input" style={{ marginTop: 10 }} value={observedText} onChange={(event) => setObservedText(event.target.value)} placeholder="اكتب النطق المسموع" /></div>}

      <label className="label" htmlFor="review-quality">جودة التسجيل</label>
      <select id="review-quality" className="select" value={quality} onChange={(event) => setQuality(event.target.value)}><option value="good">جيد</option><option value="noisy">ضوضاء</option><option value="too_short">قصير جدًا</option><option value="silence">صمت</option><option value="unclear">غير واضح</option><option value="corrupt">ملف تالف</option></select>
      <label className="label" htmlFor="review-confidence">ثقة المراجع</label>
      <select id="review-confidence" className="select" value={confidence} onChange={(event) => setConfidence(event.target.value)}><option value="high">عالية</option><option value="medium">متوسطة</option><option value="low">منخفضة</option></select>
      <label className="label" htmlFor="review-notes">ملاحظات</label><textarea id="review-notes" className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
      <div className="actions"><button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}><Save size={17} /> {saving ? "جاري الحفظ..." : "حفظ المراجعة"}</button></div>
      {message && <div className="status status-info" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
