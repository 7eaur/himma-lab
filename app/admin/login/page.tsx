"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockKeyhole, ArrowLeft } from "lucide-react";

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
    <main className="entry-shell supervisor-entry-shell">
      <div className="entry-card supervisor-login-card">
        <Link href="/" className="supervisor-logo-link" aria-label="العودة إلى هِمّة"><Image src="/himma-logo.svg" alt="هِمّة" className="himma-logo" width={220} height={100} priority /></Link>
        <div className="entry-copy supervisor-copy">
          <span className="soft-badge"><LockKeyhole size={16} /> لوحة المشرف</span>
          <h1>دخول مشرف المختبر</h1>
          <p>أدخل رمز الإدارة للوصول إلى بيانات التسجيلات والمراجعات وإنشاء أكواد المشاركين.</p>
        </div>
        <form onSubmit={submit} className="code-form">
          <label htmlFor="admin-token">رمز دخول المشرف</label>
          <div className="code-input-wrap"><LockKeyhole size={20} /><input id="admin-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="current-password" /></div>
          {error && <div className="status status-error">{error}</div>}
          <button className="primary-action" type="submit" disabled={loading || !token}>{loading ? "جاري التحقق..." : <>دخول اللوحة <ArrowLeft size={19} /></>}</button>
        </form>
        <p className="privacy-note">بيانات التسجيل محفوظة في مساحة خاصة ولا تظهر للمشاركين.</p>
      </div>
    </main>
  );
}
