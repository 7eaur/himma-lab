"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر تسجيل الدخول");
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell"><div className="container" style={{ maxWidth: 560, paddingTop: 70 }}>
      <Link className="brand" href="/"><span className="brand-mark"><LockKeyhole size={21} /></span><span>لوحة مختبر هِمّة</span></Link>
      <form className="card" onSubmit={submit} style={{ marginTop: 28 }}>
        <p className="eyebrow">SUPERVISOR ACCESS</p><h1 style={{ fontSize: 38 }}>دخول المشرف</h1>
        <p className="muted">رمز الإدارة موجود في متغيرات بيئة الاستضافة ولا يُحفظ داخل GitHub.</p>
        <label className="label" htmlFor="admin-token">رمز الدخول</label>
        <input id="admin-token" className="input" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="current-password" />
        {error && <div className="status status-error" style={{ marginTop: 14 }}>{error}</div>}
        <div className="actions"><button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "جاري التحقق..." : "دخول اللوحة"}</button></div>
      </form>
    </div></main>
  );
}
