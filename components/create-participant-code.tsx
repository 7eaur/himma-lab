"use client";

import { FormEvent, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

function generateCode() {
  return `H${Math.floor(1000 + Math.random() * 9000)}`;
}

export function CreateParticipantCode() {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [datasetSplit, setDatasetSplit] = useState("unassigned");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, label, datasetSplit }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر إنشاء الكود");
      setMessage(`تم إنشاء الكود ${payload.code}`);
      setCode("");
      setLabel("");
      setDatasetSplit("unassigned");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إنشاء الكود");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card participant-create-card">
      <div className="section-heading">
        <div>
          <h3>إضافة مشارك</h3>
          <p className="muted">أنشئ كودًا مجهولًا. إذا بدأت مرحلة المعايرة، ضع كل متحدث في مجموعة واحدة فقط حتى لا تتسرب صوته بين التدريب والتحقق.</p>
        </div>
      </div>
      <label className="label" htmlFor="new-code">كود المشارك</label>
      <div className="participant-code-row">
        <input id="new-code" className="input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="H1234" maxLength={20} />
        <button type="button" className="btn btn-secondary participant-generate-button" onClick={() => setCode(generateCode())}><RefreshCw size={16} /> توليد</button>
      </div>
      <label className="label" htmlFor="new-label">وصف اختياري</label>
      <input id="new-label" className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="مثال: تجربة العميل" />
      <label className="label" htmlFor="dataset-split">مجموعة Dataset</label>
      <select id="dataset-split" className="select" value={datasetSplit} onChange={(event) => setDatasetSplit(event.target.value)}>
        <option value="unassigned">غير معيّن الآن</option>
        <option value="development">Development — تطوير وتجارب</option>
        <option value="calibration">Calibration — ضبط الحدود</option>
        <option value="validation">Validation — تحقق نهائي مستقل</option>
      </select>
      <div className="actions"><button type="submit" className="btn btn-teal" disabled={loading || !code.trim()}><Plus size={17} /> {loading ? "جاري الإنشاء..." : "إنشاء الكود"}</button></div>
      {message && <div className="status status-info participant-create-message">{message}</div>}
    </form>
  );
}
