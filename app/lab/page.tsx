"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, CircleStop, Headphones, Mic2, RotateCcw, Send } from "lucide-react";
import { TARGETS } from "@/lib/targets";

type Verdict = "correct" | "incorrect" | "unsure";
type Quality = "good" | "noisy" | "too_short" | "silence" | "unclear";

export default function LabPage() {
  const [participantCode, setParticipantCode] = useState("");
  const [targetKey, setTargetKey] = useState(TARGETS[0].key);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [observedText, setObservedText] = useState("");
  const [quality, setQuality] = useState<Quality>("good");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);

  const target = useMemo(() => TARGETS.find((item) => item.key === targetKey) ?? TARGETS[0], [targetKey]);

  const resetSample = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationMs(0);
    setVerdict(null);
    setObservedText("");
    setQuality("good");
    setNotes("");
    setStatus(null);
  };

  const chooseTarget = (key: string) => {
    setTargetKey(key);
    resetSample();
  };

  const startRecording = async () => {
    setStatus(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setDurationMs(elapsed);
        setRecording(false);
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(200);
      setRecording(true);
      setStatus({ kind: "info", text: "التسجيل جارٍ الآن. انطق الهدف مرة واحدة بوضوح ثم أوقف التسجيل." });
    } catch {
      setStatus({ kind: "error", text: "تعذر الوصول إلى الميكروفون. اسمح للموقع باستخدامه ثم حاول مرة أخرى." });
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const submitSample = async () => {
    if (!participantCode.trim()) return setStatus({ kind: "error", text: "أدخل كود المشارك أولًا." });
    if (!audioBlob) return setStatus({ kind: "error", text: "سجّل عينة صوتية قبل الإرسال." });
    if (!verdict) return setStatus({ kind: "error", text: "حدد هل النطق صحيح أو خطأ أو غير متأكد." });
    if (verdict === "incorrect" && !observedText.trim()) return setStatus({ kind: "error", text: "عند اختيار خطأ، حدد ما الذي سمعته أو اكتب النطق المسموع." });

    setSubmitting(true);
    setStatus({ kind: "info", text: "جاري حفظ التسجيل والوسم وتحليل Azure إن كان مهيأ..." });
    try {
      const form = new FormData();
      form.append("audio", audioBlob, `sample-${Date.now()}.webm`);
      form.append("participantCode", participantCode.trim().toUpperCase());
      form.append("targetKey", target.key);
      form.append("verdict", verdict);
      form.append("observedText", observedText.trim());
      form.append("quality", quality);
      form.append("notes", notes.trim());
      form.append("durationMs", String(durationMs));

      const response = await fetch("/api/recordings", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر حفظ العينة");
      setStatus({ kind: "success", text: payload?.azureConfigured ? "تم حفظ العينة ونتيجة Azure. يمكنك الانتقال للعينة التالية." : "تم حفظ العينة والوسم. Azure غير مهيأ حاليًا، ويمكن تحليلها لاحقًا." });
      resetSample();
      setStatus({ kind: "success", text: payload?.azureConfigured ? "تم حفظ العينة ونتيجة Azure بنجاح." : "تم حفظ العينة. Azure غير مهيأ بعد." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "تعذر حفظ العينة" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="shell">
      <div className="container lab-wrap">
        <header className="topbar">
          <Link className="brand" href="/"><span className="brand-mark"><Mic2 size={21} /></span><span>جلسة جمع البيانات</span></Link>
          <Link className="btn btn-secondary" href="/"><ArrowRight size={17} /> الرئيسية</Link>
        </header>

        <div className="lab-grid">
          <aside className="card">
            <h2 className="panel-title">بيانات الجلسة</h2>
            <label className="label" htmlFor="participant-code">كود المشارك</label>
            <input id="participant-code" className="input" value={participantCode} onChange={(event) => setParticipantCode(event.target.value)} placeholder="مثال: H001" autoCapitalize="characters" />
            <p className="muted" style={{ fontSize: 13 }}>نستخدم رمزًا مجهولًا بدل الاسم. يجب أن يكون الكود مفعّلًا من المشرف.</p>

            <h3 style={{ marginTop: 26 }}>أهداف الجلسة</h3>
            <div className="target-list">
              {TARGETS.map((item) => (
                <button type="button" key={item.key} className={`target-button ${item.key === target.key ? "active" : ""}`} onClick={() => chooseTarget(item.key)} disabled={recording}>
                  <span>{item.label}</span><strong style={{ fontSize: 24 }}>{item.text}</strong>
                </button>
              ))}
            </div>
          </aside>

          <section className="card">
            <p className="eyebrow">الهدف الحالي · {target.type === "letter_with_haraka" ? "حرف وحركة" : "كلمة"}</p>
            <div className="target-big"><div><strong>{target.text}</strong><p className="muted">انطق الهدف كما هو مكتوب دون إضافة كلمات.</p></div></div>

            <div className="record-controls">
              {!recording ? <button type="button" className="btn btn-primary" onClick={() => void startRecording()}><Mic2 size={18} /> بدء التسجيل</button> : <button type="button" className="btn btn-danger" onClick={stopRecording}><CircleStop size={18} /> إيقاف التسجيل</button>}
              {audioBlob && !recording && <button type="button" className="btn btn-secondary" onClick={resetSample}><RotateCcw size={17} /> إعادة التسجيل</button>}
            </div>

            {audioUrl && <div><p className="label"><Headphones size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} />استمع قبل الحكم</p><audio controls src={audioUrl} preload="metadata" /><p className="muted" style={{ fontSize: 13 }}>مدة تقريبية: {(durationMs / 1000).toFixed(1)} ثانية</p></div>}

            {audioBlob && !recording && (
              <div style={{ marginTop: 24 }}>
                <h2>الوسم البشري</h2>
                <p className="muted">هذا الحكم أهم من نتيجة Azure في مرحلة بناء Dataset. اختر ما سمعته فعلًا، وليس ما كان يفترض أن تقوله.</p>
                <div className="annotation-grid">
                  <button type="button" className={`choice ${verdict === "correct" ? "active" : ""}`} onClick={() => { setVerdict("correct"); setObservedText(target.text); }}>النطق صحيح</button>
                  <button type="button" className={`choice ${verdict === "incorrect" ? "active" : ""}`} onClick={() => { setVerdict("incorrect"); setObservedText(""); }}>النطق خطأ</button>
                  <button type="button" className={`choice ${verdict === "unsure" ? "active" : ""}`} onClick={() => { setVerdict("unsure"); setObservedText(""); }}>غير متأكد</button>
                </div>

                {verdict === "incorrect" && (
                  <div style={{ marginTop: 18 }}>
                    <label className="label">ما الذي سمعته؟</label>
                    <div className="contrasts">
                      {target.contrasts.map((contrast) => <button type="button" key={contrast} className={`contrast ${observedText === contrast ? "active" : ""}`} onClick={() => setObservedText(contrast)}>{contrast}</button>)}
                    </div>
                    <label className="label" htmlFor="observed-text">أو اكتب النطق المسموع</label>
                    <input id="observed-text" className="input" value={observedText} onChange={(event) => setObservedText(event.target.value)} placeholder="مثال: بِ أو حرف مختلف" />
                  </div>
                )}

                <label className="label" htmlFor="quality">جودة التسجيل من وجهة نظرك</label>
                <select id="quality" className="select" value={quality} onChange={(event) => setQuality(event.target.value as Quality)}>
                  <option value="good">جيد وواضح</option><option value="noisy">فيه ضوضاء</option><option value="too_short">قصير جدًا</option><option value="silence">صمت / لم أنطق</option><option value="unclear">غير واضح</option>
                </select>

                <label className="label" htmlFor="notes">ملاحظة اختيارية</label>
                <textarea id="notes" className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="أي ملاحظة تساعد المراجع لاحقًا" />

                <div className="actions"><button type="button" className="btn btn-teal" onClick={() => void submitSample()} disabled={submitting}><Send size={17} /> {submitting ? "جاري الحفظ..." : "حفظ العينة"}</button></div>
              </div>
            )}

            {status && <div className={`status status-${status.kind}`} style={{ marginTop: 18 }}>{status.text}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
