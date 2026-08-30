"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";

export function CreateParticipantCode() {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/admin/participants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, label }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر إنشاء الكود");
      setMessage(`تم إنشاء ${payload.code}`); setCode(""); setLabel("");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إنشاء الكود"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="card">
      <h3 style={{ marginTop: 0 }}>إضافة مشارك</h3>
      <p className="muted">أنشئ رمزًا مجهولًا لكل شخص بدل تخزين اسمه الحقيقي.</p>
      <label className="label" htmlFor="new-code">كود المشارك</label>
      <input id="new-code" className="input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="H001" />
      <label className="label" htmlFor="new-label">وصف اختياري</label>
      <input id="new-label" className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="دفعة تجريبية 1" />
      <div className="actions"><button type="submit" className="btn btn-teal" disabled={loading}><Plus size={17} /> {loading ? "جاري الإنشاء..." : "إنشاء الكود"}</button></div>
      {message && <p className="muted">{message}</p>}
    </form>
  );
}
