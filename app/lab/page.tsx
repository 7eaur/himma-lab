"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleStop, Headphones, LogOut, Mic2, RotateCcw, Send, Volume2, ArrowLeft, ShieldCheck } from "lucide-react";
import { TARGETS, TARGET_SECTIONS } from "@/lib/targets";

type Verdict = "correct" | "incorrect" | "unsure";
type Quality = "good" | "noisy" | "too_short" | "silence" | "unclear";
type SavedAnalysis = {
  transcript: string | null;
  confidence: number | null;
  correct: number | null;
  deletion: number | null;
  insertion: number | null;
  substitution: number | null;
  wer: number | null;
  lexicalAccuracy: number | null;
  calibrationState: string;
};

export default function LabPage() {
  const router = useRouter();
  const [participantCode, setParticipantCode] = useState("");
  const [section, setSection] = useState(TARGET_SECTIONS[0]);
  const sectionTargets = useMemo(() => TARGETS.filter((item) => item.section === section), [section]);
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
  const [savedAnalysis, setSavedAnalysis] = useState<SavedAnalysis | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const code = sessionStorage.getItem("himma_lab_participant_code");
    if (!code) {
      router.replace("/");
      return;
    }
    void fetch("/api/participants/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).then(async (response) => {
      if (!response.ok) {
        sessionStorage.removeItem("himma_lab_participant_code");
        router.replace("/");
        return;
      }
      setParticipantCode(code);
    }).catch(() => router.replace("/"));
  }, [router]);

  const target = useMemo(() => TARGETS.find((item) => item.key === targetKey) ?? sectionTargets[0] ?? TARGETS[0], [targetKey, sectionTargets]);
  const targetIndex = sectionTargets.findIndex((item) => item.key === target.key);

  const clearRecording = () => {
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

  const resetSample = () => {
    clearRecording();
    setSavedAnalysis(null);
  };

  const chooseTarget = (key: string) => {
    setTargetKey(key);
    resetSample();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeSection = (nextSection: string) => {
    const firstTarget = TARGETS.find((item) => item.section === nextSection);
    setSection(nextSection);
    if (firstTarget) setTargetKey(firstTarget.key);
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
      setStatus({ kind: "info", text: "التسجيل جارٍ الآن. اقرأ المطلوب بصوت واضح، ثم اضغط إيقاف." });
    } catch {
      setStatus({ kind: "error", text: "تعذر فتح الميكروفون. اسمح للموقع باستخدام الميكروفون ثم حاول مرة أخرى." });
    }
  };

  const stopRecording = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };

  const submitSample = async () => {
    if (!participantCode) return router.replace("/");
    if (!audioBlob) return setStatus({ kind: "error", text: "سجّل القراءة أولًا." });
    if (!verdict) return setStatus({ kind: "error", text: "حدد هل النطق صحيح أو خطأ أو غير متأكد." });
    if (verdict === "incorrect" && !observedText.trim()) return setStatus({ kind: "error", text: "حدد ما الذي نطقته أو ما الذي سمعته." });
    setSubmitting(true);
    setStatus({ kind: "info", text: "جاري حفظ التسجيل وتحليل القراءة..." });
    try {
      const form = new FormData();
      form.append("audio", audioBlob, `sample-${Date.now()}.webm`);
      form.append("participantCode", participantCode);
      form.append("targetKey", target.key);
      form.append("verdict", verdict);
      form.append("observedText", observedText.trim());
      form.append("quality", quality);
      form.append("notes", notes.trim());
      form.append("durationMs", String(durationMs));
      const response = await fetch("/api/recordings", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر حفظ العينة");
      setSavedAnalysis(payload?.analysis ?? null);
      setStatus({ kind: "success", text: "تم حفظ التسجيل والوسم البشري ونتيجة التحليل." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "تعذر حفظ العينة" });
    } finally {
      setSubmitting(false);
    }
  };

  const nextTarget = () => {
    const next = sectionTargets[targetIndex + 1];
    if (next) chooseTarget(next.key);
    else clearRecording();
  };

  const logout = () => {
    sessionStorage.removeItem("himma_lab_participant_code");
    router.replace("/");
  };

  if (!participantCode) return <main className="entry-shell"><div className="entry-card"><Image src="/himma-logo.svg" alt="هِمّة" className="himma-logo" width={190} height={86} /><p className="loading-copy">جاري التحقق من كود المشاركة...</p></div></main>;

  return (
    <main className="lab-shell">
      <header className="lab-header">
        <div className="lab-header-inner">
          <Image src="/himma-logo.svg" alt="هِمّة" className="lab-logo" width={128} height={58} priority />
          <div className="session-chip"><span>{participantCode}</span><button type="button" onClick={logout} aria-label="خروج"><LogOut size={17} /></button></div>
        </div>
      </header>

      <div className="lab-mobile-container">
        <section className="lab-intro-strip"><ShieldCheck size={18} /><span>مختبر هِمّة للقراءة والنطق</span><small>{TARGETS.length} هدف قراءة معتمد</small></section>

        <section className="progress-row">
          <div><span>{section}</span><strong>{targetIndex + 1} من {sectionTargets.length}</strong></div>
          <div className="progress-track"><span style={{ width: `${((targetIndex + 1) / Math.max(sectionTargets.length, 1)) * 100}%` }} /></div>
        </section>

        <section className="section-picker-card">
          <label htmlFor="section">مجموعة المحتوى</label>
          <select id="section" value={section} onChange={(event) => changeSection(event.target.value)} disabled={recording || Boolean(savedAnalysis)}>
            {TARGET_SECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <div className="target-scroll" aria-label="عناصر المجموعة">
            {sectionTargets.map((item, index) => <button type="button" key={item.key} className={item.key === target.key ? "active" : ""} onClick={() => chooseTarget(item.key)} disabled={recording || Boolean(savedAnalysis)}>{index + 1}</button>)}
          </div>
        </section>

        <section className="reading-card">
          <span className="task-label"><Volume2 size={17} /> {target.label}</span>
          <p className="instruction">{target.instruction}</p>
          <div className={`reading-target reading-target-${target.type}`}>{target.text}</div>

          {!audioBlob && !recording && !savedAnalysis && <button type="button" className="record-main" onClick={() => void startRecording()}><span><Mic2 size={29} /></span>ابدأ التسجيل</button>}
          {recording && <button type="button" className="record-main recording" onClick={stopRecording}><span><CircleStop size={29} /></span>إيقاف التسجيل</button>}

          {status && <div className={`status status-${status.kind}`}>{status.text}</div>}

          {audioUrl && !recording && <div className="review-audio"><div className="review-audio-title"><Headphones size={18} /><strong>استمع لتسجيلك</strong><span>{(durationMs / 1000).toFixed(1)} ث</span></div><audio controls src={audioUrl} preload="metadata" />{!savedAnalysis && <button type="button" className="retry-link" onClick={resetSample}><RotateCcw size={16} /> إعادة التسجيل</button>}</div>}
        </section>

        {audioBlob && !recording && !savedAnalysis && <section className="annotation-card">
          <div className="annotation-heading"><CheckCircle2 size={22} /><div><h2>كيف كان النطق؟</h2><p>اختر ما حدث فعلًا. هذا هو الـGround Truth الذي سنقارن به نتيجة النظام.</p></div></div>
          <div className="verdict-options">
            <button type="button" className={verdict === "correct" ? "active good" : ""} onClick={() => { setVerdict("correct"); setObservedText(target.text); }}>نطقتُه بشكل صحيح</button>
            <button type="button" className={verdict === "incorrect" ? "active bad" : ""} onClick={() => { setVerdict("incorrect"); setObservedText(""); }}>كان هناك خطأ</button>
            <button type="button" className={verdict === "unsure" ? "active unsure" : ""} onClick={() => { setVerdict("unsure"); setObservedText(""); }}>غير متأكد</button>
          </div>

          {verdict === "incorrect" && <div className="observed-box">
            <label>ماذا نطقت أو ماذا سمعت؟</label>
            {target.contrasts.length > 0 && <div className="contrast-grid">{target.contrasts.map((contrast) => <button type="button" key={contrast} className={observedText === contrast ? "active" : ""} onClick={() => setObservedText(contrast)}>{contrast}</button>)}</div>}
            <input value={observedText} onChange={(event) => setObservedText(event.target.value)} placeholder="اكتب النطق الذي حدث" />
          </div>}

          <details className="optional-details"><summary>معلومات إضافية اختيارية</summary><label>جودة التسجيل<select value={quality} onChange={(event) => setQuality(event.target.value as Quality)}><option value="good">واضح</option><option value="noisy">فيه ضوضاء</option><option value="too_short">قصير جدًا</option><option value="silence">صمت</option><option value="unclear">غير واضح</option></select></label><label>ملاحظة<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ملاحظة للمراجع" /></label></details>

          <button type="button" className="primary-action" onClick={() => void submitSample()} disabled={submitting || !verdict}><Send size={18} /> {submitting ? "جاري الحفظ والتحليل..." : "حفظ وتحليل التسجيل"}</button>
        </section>}

        {savedAnalysis && <section className="analysis-result-card">
          <div className="analysis-result-heading"><CheckCircle2 size={23} /><div><h2>نتيجة العينة المحفوظة</h2><p>هذه نتائج آلية مساعدة للمعايرة، وليست درجة أكاديمية.</p></div></div>
          <div className="analysis-transcript"><span>ما تعرّف عليه Azure</span><strong>{savedAnalysis.transcript || "لم يتعرّف على كلام واضح"}</strong></div>
          <div className="analysis-metrics">
            <div><span>الدقة اللفظية</span><strong>{savedAnalysis.lexicalAccuracy == null ? "—" : `${Math.round(savedAnalysis.lexicalAccuracy * 100)}%`}</strong></div>
            <div><span>WER</span><strong>{savedAnalysis.wer == null ? "—" : `${Math.round(savedAnalysis.wer * 100)}%`}</strong></div>
            <div><span>ثقة Azure</span><strong>{savedAnalysis.confidence == null ? "—" : `${Math.round(savedAnalysis.confidence * 100)}%`}</strong></div>
          </div>
          <div className="cdis-grid">
            <div><span>صحيح</span><strong>{savedAnalysis.correct ?? "—"}</strong></div>
            <div><span>حذف</span><strong>{savedAnalysis.deletion ?? "—"}</strong></div>
            <div><span>إضافة</span><strong>{savedAnalysis.insertion ?? "—"}</strong></div>
            <div><span>استبدال</span><strong>{savedAnalysis.substitution ?? "—"}</strong></div>
          </div>
          <div className="calibration-warning"><ShieldCheck size={18} /><div><strong>الحروف والحركات: غير معايرة بعد</strong><p>نحفظ المرجع المشكول والوسم البشري الآن. لن نقول إن الفتحة أو الكسرة أو الضمة صحيحة آليًا حتى نثبت ذلك من هذه البيانات.</p></div></div>
          <button type="button" className="primary-action" onClick={nextTarget}><span>التالي</span><ArrowLeft size={19} /></button>
        </section>}
      </div>
    </main>
  );
}
