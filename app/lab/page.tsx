"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleStop, Headphones, LogOut, Mic2, RotateCcw, Send, Volume2, ArrowLeft, ShieldCheck } from "lucide-react";
import { TARGETS, TARGET_SECTIONS, type CalibrationTarget } from "@/lib/targets";
import { analyzeClientAudio } from "@/lib/client-audio-quality";
import {
  CONFIDENCE_LABELS,
  ERROR_CATEGORY_LABELS,
  UNSURE_REASON_LABELS,
  VALIDITY_LABELS,
  createUnitAnnotations,
  supportsDetailedUnits,
  type Confidence,
  type ErrorCategory,
  type UnsureReason,
  type UnitAnnotation,
  type Validity,
} from "@/lib/calibration";
import { UnitAnnotationEditor } from "@/components/unit-annotation-editor";

type Verdict = "correct" | "incorrect" | "unsure";

const targetOptionText = (label: string, text: string, index: number) => {
  const clean = text.replace(/\s+/g, " ").trim();
  const preview = clean.length > 88 ? `${clean.slice(0, 88)}…` : clean;
  return `${index + 1}. ${label} — ${preview}`;
};

const participantValidities: Validity[] = ["valid", "silence", "noisy", "too_short", "unclear"];

function annotationsFor(target: CalibrationTarget): UnitAnnotation[] {
  return supportsDetailedUnits(target.type) ? createUnitAnnotations(target.text) : [];
}

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
  const [validity, setValidity] = useState<Validity>("valid");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [observedText, setObservedText] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("high");
  const [errorCategory, setErrorCategory] = useState<ErrorCategory | "">("");
  const [unsureReason, setUnsureReason] = useState<UnsureReason | "">("");
  const [unitAnnotations, setUnitAnnotations] = useState<UnitAnnotation[]>(annotationsFor(TARGETS[0]));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
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

  const resetGroundTruth = (nextTarget: CalibrationTarget) => {
    setValidity("valid");
    setVerdict(null);
    setObservedText("");
    setConfidence("high");
    setErrorCategory("");
    setUnsureReason("");
    setUnitAnnotations(annotationsFor(nextTarget));
    setNotes("");
  };

  const clearRecording = (nextTarget = target) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationMs(0);
    resetGroundTruth(nextTarget);
    setStatus(null);
  };

  const resetSample = () => {
    clearRecording(target);
    setSaved(false);
  };

  const chooseTarget = (key: string) => {
    const nextTarget = TARGETS.find((item) => item.key === key) ?? target;
    setTargetKey(key);
    clearRecording(nextTarget);
    setSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeSection = (nextSection: string) => {
    const firstTarget = TARGETS.find((item) => item.section === nextSection);
    setSection(nextSection);
    if (firstTarget) {
      setTargetKey(firstTarget.key);
      clearRecording(firstTarget);
    }
    setSaved(false);
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

  const selectVerdict = (next: Verdict) => {
    setVerdict(next);
    setErrorCategory("");
    setUnsureReason("");
    if (next === "correct") {
      setObservedText(target.text);
      setUnitAnnotations(annotationsFor(target));
    } else {
      setObservedText("");
    }
  };

  const submitSample = async () => {
    if (!participantCode) return router.replace("/");
    if (!audioBlob) return setStatus({ kind: "error", text: "سجّل القراءة أولًا." });
    if (!verdict) return setStatus({ kind: "error", text: "حدد هل النطق صحيح أو خطأ أو غير متأكد." });
    if (verdict === "incorrect" && (!observedText.trim() || !errorCategory)) return setStatus({ kind: "error", text: "حدد نوع الخطأ وما الذي نطقته أو سمعته." });
    if (verdict === "unsure" && !unsureReason) return setStatus({ kind: "error", text: "حدد لماذا لم تكن متأكدًا من النطق." });
    if (verdict === "incorrect" && supportsDetailedUnits(target.type) && ["haraka", "letter", "shadda", "sukun", "tanween"].includes(errorCategory) && unitAnnotations.every((unit) => unit.verdict === "correct")) {
      return setStatus({ kind: "error", text: "حدد موضع الخطأ داخل الحرف أو الحركة حتى نحفظ Ground Truth دقيقًا." });
    }

    setSubmitting(true);
    setStatus({ kind: "info", text: "جاري فحص جودة التسجيل وحفظه..." });
    try {
      const audioQuality = await analyzeClientAudio(audioBlob);
      const form = new FormData();
      form.append("audio", audioBlob, `sample-${Date.now()}.webm`);
      form.append("participantCode", participantCode);
      form.append("targetKey", target.key);
      form.append("verdict", verdict);
      form.append("observedText", observedText.trim());
      form.append("validity", validity);
      form.append("confidence", confidence);
      form.append("errorCategory", errorCategory);
      form.append("unsureReason", unsureReason);
      form.append("unitAnnotations", JSON.stringify(unitAnnotations));
      form.append("notes", notes.trim());
      form.append("durationMs", String(durationMs));
      if (audioQuality.decodedDurationMs != null) form.append("decodedDurationMs", String(audioQuality.decodedDurationMs));
      if (audioQuality.rms != null) form.append("rms", String(audioQuality.rms));
      if (audioQuality.peak != null) form.append("peak", String(audioQuality.peak));
      if (audioQuality.silenceRatio != null) form.append("silenceRatio", String(audioQuality.silenceRatio));
      const response = await fetch("/api/recordings", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر حفظ العينة");
      setSaved(true);
      setStatus({ kind: "success", text: "تم حفظ التسجيل بنجاح. يمكنك الانتقال إلى النص التالي." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "تعذر حفظ العينة" });
    } finally {
      setSubmitting(false);
    }
  };

  const nextTarget = () => {
    const next = sectionTargets[targetIndex + 1];
    if (next) chooseTarget(next.key);
    else clearRecording(target);
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

        <section className="section-picker-card content-navigator-card">
          <div className="content-navigator-grid">
            <label className="content-select-field" htmlFor="section"><span>مجموعة المحتوى</span><select id="section" value={section} onChange={(event) => changeSection(event.target.value)} disabled={recording || saved}>{TARGET_SECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="content-select-field" htmlFor="target"><span>النص المطلوب تسجيله</span><select id="target" value={target.key} onChange={(event) => chooseTarget(event.target.value)} disabled={recording || saved}>{sectionTargets.map((item, index) => <option key={item.key} value={item.key}>{targetOptionText(item.label, item.text, index)}</option>)}</select></label>
          </div>
          <p className="content-current-preview"><strong>المحدد الآن:</strong> {target.text}</p>
        </section>

        <section className="reading-card">
          <span className="task-label"><Volume2 size={17} /> {target.label}</span>
          <p className="instruction">{target.instruction}</p>
          <div className={`reading-target reading-target-${target.type}`}>{target.text}</div>
          {!audioBlob && !recording && !saved && <button type="button" className="record-main" onClick={() => void startRecording()}><span><Mic2 size={29} /></span>ابدأ التسجيل</button>}
          {recording && <button type="button" className="record-main recording" onClick={stopRecording}><span><CircleStop size={29} /></span>إيقاف التسجيل</button>}
          {status && <div className={`status status-${status.kind}`}>{status.text}</div>}
          {audioUrl && !recording && <div className="review-audio"><div className="review-audio-title"><Headphones size={18} /><strong>استمع لتسجيلك</strong><span>{(durationMs / 1000).toFixed(1)} ث</span></div><audio controls src={audioUrl} preload="metadata" />{!saved && <button type="button" className="retry-link" onClick={resetSample}><RotateCcw size={16} /> إعادة التسجيل</button>}</div>}
        </section>

        {audioBlob && !recording && !saved && <section className="annotation-card rich-ground-truth-card">
          <div className="annotation-heading"><CheckCircle2 size={22} /><div><h2>راجع التسجيل قبل الحفظ</h2><p>هذه البيانات هي Ground Truth التي سنستخدمها لمعايرة الحروف والحركات ومقارنة نتيجة Azure بالحكم البشري.</p></div></div>

          <div className="ground-truth-step">
            <div className="ground-truth-step-title"><span>1</span><div><strong>هل التسجيل صالح للحكم؟</strong><small>قيّم التسجيل نفسه قبل تقييم النطق.</small></div></div>
            <div className="validity-grid">{participantValidities.map((item) => <button type="button" key={item} className={validity === item ? "active" : ""} onClick={() => setValidity(item)}>{VALIDITY_LABELS[item]}</button>)}</div>
            {validity !== "valid" && <p className="ground-truth-hint">سيُحفظ التسجيل كعينة جودة، لكن لن نعامله كدليل نطق قوي حتى يراجعه المشرف.</p>}
          </div>

          <div className="ground-truth-step">
            <div className="ground-truth-step-title"><span>2</span><div><strong>هل نُطق الهدف كما هو مكتوب؟</strong><small>اختر الحكم الأقرب لما حدث فعلًا.</small></div></div>
            <div className="verdict-options">
              <button type="button" className={verdict === "correct" ? "active good" : ""} onClick={() => selectVerdict("correct")}>نطقتُه بشكل صحيح</button>
              <button type="button" className={verdict === "incorrect" ? "active bad" : ""} onClick={() => selectVerdict("incorrect")}>كان هناك خطأ</button>
              <button type="button" className={verdict === "unsure" ? "active unsure" : ""} onClick={() => selectVerdict("unsure")}>غير متأكد</button>
            </div>
          </div>

          {verdict === "incorrect" && <div className="ground-truth-step nested-step">
            <div className="ground-truth-step-title"><span>3</span><div><strong>ما نوع الخطأ؟</strong><small>حدد الفئة الأساسية، ثم اكتب أو اختر ما سمعته.</small></div></div>
            <div className="error-category-grid">{(Object.keys(ERROR_CATEGORY_LABELS) as ErrorCategory[]).map((item) => <button type="button" key={item} className={errorCategory === item ? "active" : ""} onClick={() => setErrorCategory(item)}>{ERROR_CATEGORY_LABELS[item]}</button>)}</div>
            <div className="observed-box">
              <label>ماذا نطقت أو ماذا سمعت؟</label>
              {target.contrasts.length > 0 && <div className="contrast-grid">{target.contrasts.map((contrast) => <button type="button" key={contrast} className={observedText === contrast ? "active" : ""} onClick={() => setObservedText(contrast)}>{contrast}</button>)}</div>}
              <input value={observedText} onChange={(event) => setObservedText(event.target.value)} placeholder="مثال: بُ بدل بِ" />
            </div>
          </div>}

          {verdict === "unsure" && <div className="ground-truth-step nested-step">
            <div className="ground-truth-step-title"><span>3</span><div><strong>لماذا أنت غير متأكد؟</strong><small>هذا يمنع خلط مشكلة التسجيل مع مشكلة النطق.</small></div></div>
            <div className="error-category-grid">{(Object.keys(UNSURE_REASON_LABELS) as UnsureReason[]).map((item) => <button type="button" key={item} className={unsureReason === item ? "active" : ""} onClick={() => setUnsureReason(item)}>{UNSURE_REASON_LABELS[item]}</button>)}</div>
            <label className="ground-truth-field"><span>إذا كان لديك تخمين، ماذا سمعت؟ <small>اختياري</small></span><input value={observedText} onChange={(event) => setObservedText(event.target.value)} placeholder="اكتب أقرب نطق سمعته" /></label>
          </div>}

          {verdict && verdict !== "correct" && supportsDetailedUnits(target.type) && <UnitAnnotationEditor value={unitAnnotations} onChange={setUnitAnnotations} />}

          {verdict && <div className="ground-truth-step compact-step">
            <div className="ground-truth-step-title"><span>4</span><div><strong>ما مدى ثقتك في هذا الحكم؟</strong><small>الثقة هنا بشرية، وليست ثقة Azure.</small></div></div>
            <div className="confidence-grid">{(Object.keys(CONFIDENCE_LABELS) as Confidence[]).map((item) => <button type="button" key={item} className={confidence === item ? "active" : ""} onClick={() => setConfidence(item)}>{CONFIDENCE_LABELS[item]}</button>)}</div>
          </div>}

          <details className="optional-details"><summary>ملاحظة إضافية اختيارية</summary><label>ملاحظة<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="أي ملاحظة تساعد المراجع لاحقًا" /></label></details>

          <button type="button" className="primary-action" onClick={() => void submitSample()} disabled={submitting || !verdict}><Send size={18} /> {submitting ? "جاري الحفظ والتحليل..." : "حفظ وإرسال للمراجعة"}</button>
        </section>}

        {saved && <section className="analysis-result-card participant-save-confirmation">
          <div className="analysis-result-heading"><CheckCircle2 size={23} /><div><h2>تم حفظ التسجيل</h2><p>شكرًا لك. تم إرسال التسجيل للمراجعة، ويمكنك الآن الانتقال إلى النص التالي.</p></div></div>
          <button type="button" className="primary-action" onClick={nextTarget}><span>التالي</span><ArrowLeft size={19} /></button>
        </section>}
      </div>
    </main>
  );
}
