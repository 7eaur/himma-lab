"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalized = code.trim().toUpperCase();
      const response = await fetch("/api/participants/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر التحقق من الكود.");
      sessionStorage.setItem("himma_lab_participant_code", payload.code);
      router.push("/lab");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر التحقق من الكود.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="entry-shell">
      <div className="entry-card">
        <div className="entry-brand">
          <Image src="/himma-logo.svg" alt="هِمّة" className="himma-logo" width={230} height={105} priority />
          <p>أتعلم، أتطور، أصل إلى القمة</p>
        </div>

        <div className="entry-copy">
          <span className="soft-badge"><ShieldCheck size={16} /> مختبر القراءة والنطق</span>
          <h1>مرحبًا بك في مختبر هِمّة</h1>
          <p>أدخل كود المشاركة الذي حصلت عليه، ثم ستبدأ جلسة قراءة قصيرة وواضحة خطوة بخطوة.</p>
        </div>

        <form onSubmit={submit} className="code-form">
          <label htmlFor="participant-code">كود المشاركة</label>
          <div className="code-input-wrap"><KeyRound size={20} /><input id="participant-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="مثال: H001" autoComplete="one-time-code" autoCapitalize="characters" maxLength={20} autoFocus /></div>
          {error && <div className="status status-error">{error}</div>}
          <button className="primary-action" type="submit" disabled={loading || !code.trim()}>{loading ? "جاري التحقق..." : <>دخول المختبر <ArrowLeft size={19} /></>}</button>
        </form>

        <p className="privacy-note">لا نطلب اسمك. التسجيلات تُستخدم في اختبار وتحسين دقة تحليل القراءة فقط.</p>
        <Link className="admin-entry" href="/admin/login">دخول المشرف</Link>
      </div>
    </main>
  );
}
