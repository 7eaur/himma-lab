"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Mic, RotateCcw, Save, Square, TestTube2 } from "lucide-react";
import { analyzePcm16Wav, blocksAnalysis, type AudioQualityEvidence } from "@/lib/audio-quality";
import { PcmWavRecorder } from "@/lib/pcm-wav-recorder";
import { groupVoiceCasesForDisplay } from "@/lib/voice-case-order";
import styles from "./speech-test.module.css";

type SpeechMode = "targeted_pronunciation" | "lexical" | "fluency";
type TestCase = {
  sequence: number;
  key: string;
  sourceQuestionId: string;
  group: string;
  groupLabel: string;
  ownerId: string | null;
  role: string;
  prompt: string;
  label: string;
  text: string;
  mode: SpeechMode;
  pronunciationAssessment: boolean;
  focus: string | null;
  skillGroup: string | null;
  errorFocus: string | null;
};

type ProviderStatus = {
  lexical: { provider: string; configured: boolean; locale: string };
  pronunciation: { provider: string; configured: boolean; locale: string };
  storage: { configured: boolean };
  academicEffect: "none";
};

type AnalysisResult = {
  participantCode: string;
  runId: string;
  createdAt: string;
  label: string;
  speechMode: SpeechMode;
  pronunciationFocus: string | null;
  referenceText: string;
  audioQuality: AudioQualityEvidence;
  asr: {
    configured: boolean;
    provider: string;
    locale: string;
    transcript: string | null;
    confidence: number | null;
    durationSeconds: number | null;
    words: Array<{ text: string; startSeconds: number | null; endSeconds: number | null }>;
    requestId: string | null;
    error: string | null;
    recognitionStatus: string | null;
    source: "short-audio" | "fast-transcription" | "none";
    transcriptScript: "arabic" | "non_arabic" | "empty";
    usable: boolean;
    snr: number | null;
    diagnostics: {
      primarySource: string;
      primaryStatus: string | null;
      primaryError: string | null;
      fallbackSource: string | null;
      fallbackStatus: string | null;
      fallbackError: string | null;
      phraseLocales: string[];
    };
  };
  reading: {
    normalizedReference: string;
    normalizedTranscript: string | null;
    alignment: Array<{ status: string; reference: string | null; observed: string | null }>;
    correct: number | null;
    deletion: number | null;
    insertion: number | null;
    substitution: number | null;
    wer: number | null;
    lexicalAccuracy: number | null;
  };
  alias: {
    matched: boolean;
    matchedAlias: string | null;
    matchKind: "bare_letter" | "long_vowel_spelling" | "latin_transliteration" | "arabic_letter_name_spelling" | "chinese_phonetic_hypothesis" | "exact_vowelled_text" | null;
    evidenceSource: "observed_human_correct" | "pinyin_candidate" | null;
    pinyin: string | null;
    effect: string | null;
    vowelVerified: false;
    warning: string | null;
  };
  pronunciation: null | {
    configured: boolean;
    provider: string;
    locale: string;
    transcript: string | null;
    recognitionStatus: string | null;
    confidence: number | null;
    accuracyScore: number | null;
    fluencyScore: number | null;
    completenessScore: number | null;
    pronunciationScore: number | null;
    words: Array<{
      word: string;
      accuracyScore: number | null;
      errorType: string | null;
      phonemeScores: number[];
    }>;
    error: string | null;
  };
  decision: {
    state: "correct" | "incorrect" | "retry_required";
    reason: string;
    academicEffect: "none";
  };
};

const decisionLabel = {
  correct: "صحيح",
  incorrect: "خطأ",
  retry_required: "بانتظار مراجعة أو دليل إضافي",
} as const;

const decisionReasonLabel: Record<string, string> = {
  no_transcript: "لم يتعرّف Azure على كلمات واضحة",
  azure_no_match: "لم يتعرف Azure على الكلام",
  azure_non_arabic_transcript: "التفريغ ليس باللغة العربية المطلوبة",
  asr_spelling_variant_requires_human_vowel_verification: "تفريغ محتمل، لكن الحركة القصيرة غير مؤكدة",
  pronunciation_evidence_pending_calibration: "لم تُعتمد بعد حدود موثوقة للحكم على النطق",
  pronunciation_evidence_unavailable: "دليل تقييم النطق غير متاح",
  lexical_mismatch_needs_confirmation: "هناك اختلاف بين النصين يحتاج مراجعة",
  exact_lexical_match: "تطابق الكلمات المكتوبة لا يعني وحده صحة جميع الحركات",
  fluency_policy_pending: "سياسة الطلاقة لم تُعتمد بعد",
};

const alignmentLabel: Record<string, string> = {
  correct: "صحيح",
  deletion: "حذف",
  insertion: "إضافة",
  substitution: "استبدال",
};

const percent01 = (value: number | null | undefined) =>
  value == null ? "—" : `${Math.round(value * 1000) / 10}%`;

const percent100 = (value: number | null | undefined) =>
  value == null ? "—" : `${Math.round(value * 10) / 10}%`;

function qualityMessage(quality: AudioQualityEvidence) {
  if (quality.state === "invalid") return "ملف الصوت غير صالح تقنيًا؛ يُرجى إعادة التسجيل.";
  if (quality.state === "silence") return "الموجة الصوتية كلها أصفار. قد يكون الميكروفون لا يسجل؛ يمكنك إعادته أو إرساله للتحليل التجريبي.";
  if (quality.state === "too_short" || quality.warnings.includes("audio_brief_sample")) {
    return "التسجيل قصير، وهذا متوقع عند قراءة حرف. يمكنك إرساله للتحليل دون إعادة إجبارية.";
  }
  if (quality.warnings.includes("audio_signal_low") || quality.warnings.includes("audio_mostly_low_energy") || quality.warnings.includes("audio_mostly_silence")) {
    return "الصوت منخفض وفق القياس التقني، وقد توجد قراءة صحيحة رغم ذلك. يمكنك تحليله أو إعادة التسجيل اختياريًا.";
  }
  if (quality.warnings.includes("audio_may_be_clipped")) return "بعض الإشارات مرتفعة جدًا. يمكنك التحليل أو إعادة التسجيل إذا سُمِع تشويش.";
  return "ملف الصوت جاهز للتحليل.";
}

function asrErrorMessage(error: string | null) {
  if (!error) return null;
  if (error === "azure_non_arabic_transcript") return "أعاد Azure نصًا بكتابة غير عربية؛ تم استبعاده من C/D/I/S بدل اعتباره قراءة عربية.";
  if (error === "azure_no_match") return "رصد Azure صوتًا لكنه لم يطابق كلمات عربية من اللغة المستهدفة.";
  if (error === "azure_initial_silence_timeout") return "بدأ التسجيل بصمت طويل ولم يبدأ التعرف.";
  if (error === "azure_babble_timeout") return "غلبت الضوضاء على بداية التسجيل ولم يتمكن Azure من بدء التعرف.";
  if (error === "azure_no_transcript") return "اكتمل الطلب لكن Azure لم يرجع نصًا.";
  return `حالة المزود: ${error}`;
}

export default function SpeechTestPage() {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [participantCode, setParticipantCode] = useState("HIMMA21");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioQuality, setAudioQuality] = useState<AudioQualityEvidence | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [message, setMessage] = useState("");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [feedbackVerdict, setFeedbackVerdict] = useState<"correct" | "incorrect" | "unclear" | "">("");
  const [providerVerdict, setProviderVerdict] = useState<"accurate" | "inaccurate" | "unclear" | "">("");
  const [modelVerdict, setModelVerdict] = useState<"appropriate" | "inappropriate" | "unclear" | "">("");
  const [modelNotes, setModelNotes] = useState("");
  const [providerObservedText, setProviderObservedText] = useState("");
  const [providerNotes, setProviderNotes] = useState("");
  const [observedText, setObservedText] = useState("");
  const [notes, setNotes] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const recorderRef = useRef<PcmWavRecorder | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [casesResponse, statusResponse] = await Promise.all([
          fetch("/api/speech-test/cases", { cache: "no-store" }),
          fetch("/api/speech-test/status", { cache: "no-store" }),
        ]);
        const casesPayload = await casesResponse.json();
        const statusPayload = await statusResponse.json();
        if (!casesResponse.ok) throw new Error(casesPayload?.detail || "تعذر تحميل حالات الاختبار");
        if (!statusResponse.ok) throw new Error(statusPayload?.detail || "تعذر قراءة حالة المزود");
        setCases(casesPayload.cases || []);
        setSelectedKey(casesPayload.cases?.[0]?.key || "");
        setProviderStatus(statusPayload);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "تعذر تحميل المختبر");
      }
    };
    void load();
  }, []);

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const selected = useMemo(() => cases.find((item) => item.key === selectedKey) || null, [cases, selectedKey]);
  // عرض أبسط للطفل والمختبِر: الحروف، الكلمات، الجمل، النصوص.
  // يبقى ترتيب بنك V2 الأصلي ومعرّف كل سؤال محفوظًا كما هو.
  const grouped = useMemo(() => groupVoiceCasesForDisplay(cases), [cases]);

  const resetResult = () => {
    setResult(null);
    setFeedbackVerdict("");
    setProviderVerdict("");
    setModelVerdict("");
    setModelNotes("");
    setProviderObservedText("");
    setProviderNotes("");
    setObservedText("");
    setNotes("");
    setFeedbackSaved(false);
  };

  const replaceAudio = (blob: Blob | null) => {
    resetResult();
    setAudioBlob(blob);
    if (!blob) setAudioQuality(null);
    setAudioUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return blob ? URL.createObjectURL(blob) : null;
    });
  };

  const startRecording = async () => {
    setMessage("");
    try {
      const recorder = new PcmWavRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = performance.now();
      setDurationMs(null);
      replaceAudio(null);
      setRecording(true);
    } catch {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      setMessage("تعذر استخدام الميكروفون. تحقق من إذن المتصفح.");
    }
  };

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    try {
      const blob = await recorder.stop();
      const startedAt = startedAtRef.current;
      setDurationMs(startedAt == null ? null : Math.max(0, performance.now() - startedAt));
      const quality = analyzePcm16Wav(new Uint8Array(await blob.arrayBuffer()));
      setAudioQuality(quality);
      replaceAudio(blob);
    } catch {
      recorder.cancel();
      setAudioQuality(null);
      setMessage("تعذر تجهيز التسجيل. أعد التسجيل.");
    } finally {
      recorderRef.current = null;
      startedAtRef.current = null;
      setRecording(false);
    }
  };

  const analyze = async () => {
    if (!selected || !audioBlob) return;
    setAnalyzing(true);
    setMessage("");
    resetResult();
    try {
      const form = new FormData();
      form.append("participantCode", participantCode.trim().toUpperCase());
      form.append("testKey", selected.key);
      if (durationMs != null) form.append("durationMs", String(durationMs));
      form.append("audio", audioBlob, `speech-test-${selected.key}.wav`);

      const response = await fetch("/api/speech-test/analyze", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.audioQuality) setAudioQuality(payload.audioQuality);
        throw new Error(payload?.detail || "تعذر تحليل التسجيل");
      }
      setResult(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحليل التسجيل");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveFeedback = async () => {
    if (!result || (!feedbackVerdict && !providerVerdict && !modelVerdict)) return;
    setSavingFeedback(true);
    setMessage("");
    try {
      const response = await fetch("/api/speech-test/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantCode: result.participantCode,
          runId: result.runId,
          verdict: feedbackVerdict || undefined,
          observedText,
          notes,
          providerVerdict: providerVerdict || undefined,
          providerObservedText: providerVerdict === "inaccurate" ? providerObservedText : "",
          providerNotes,
          modelVerdict: modelVerdict || undefined,
          modelNotes,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر حفظ تقييمك");
      setFeedbackSaved(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ تقييمك");
    } finally {
      setSavingFeedback(false);
    }
  };

  const audioBlocked = audioQuality ? blocksAnalysis(audioQuality) : false;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Image src="/himma-logo.svg" alt="هِمّة" width={138} height={62} priority />
          <div>
            <span>مختبر القرار الصوتي</span>
            <strong>النسخة التجريبية المباشرة</strong>
          </div>
        </div>
        <div className={styles.headerStatus}>
          <div className={styles.labBadge}><TestTube2 size={17} /> Experiment · لا أثر أكاديمي</div>
          <div className={styles.providerPills}>
            <span data-ready={providerStatus?.lexical.configured ? "true" : "false"}>ASR {providerStatus?.lexical.configured ? "جاهز" : "غير جاهز"}</span>
            <span data-ready={providerStatus?.pronunciation.configured ? "true" : "false"}>Pronunciation {providerStatus?.pronunciation.configured ? "جاهز" : "غير جاهز"}</span>
            <span data-ready={providerStatus?.storage.configured ? "true" : "false"}>Storage {providerStatus?.storage.configured ? "جاهز" : "غير جاهز"}</span>
          </div>
        </div>
      </header>

      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sideTitle}>
            <h2>حالات الاختبار</h2>
            <span>{cases.length}</span>
          </div>
          {grouped.map((group) => (
            <div className={styles.caseGroup} key={group.key}>
              <h3>{group.label} ({group.cases.length})</h3>
              {group.cases.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={item.key === selectedKey ? styles.activeCase : ""}
                  onClick={() => { setSelectedKey(item.key); replaceAudio(null); setDurationMs(null); setMessage(""); }}
                >
                  <strong>{item.label}</strong>
                  <small>{item.text}</small>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className={styles.main}>
          {message && <div className={styles.message}><CircleAlert size={18} />{message}</div>}

          {selected ? (
            <>
              <section className={styles.testCard}>
                <div className={styles.cardTop}>
                  <div>
                    <span className={styles.mode}>{selected.groupLabel}</span>
                    <h1>{selected.prompt.replace(" بصوت واضح.", "")}</h1>
                  </div>
                  <label className={styles.codeField}>
                    <span>كود التجربة</span>
                    <input value={participantCode} onChange={(event) => setParticipantCode(event.target.value)} />
                  </label>
                </div>

                <div className={styles.reference}>{selected.text}</div>
                <p className={styles.hint}><strong>{selected.prompt}</strong></p>
                <p className={styles.hint} dir="rtl">
                  استمع إلى تسجيلك ثم حلّله وقيّم النطق بنفسك. جميع قرارات المختبر تجريبية فقط.
                </p>

                <div className={styles.recordZone}>
                  {!recording ? (
                    <button className={styles.recordButton} type="button" onClick={() => void startRecording()}>
                      <Mic size={22} /> ابدأ التسجيل
                    </button>
                  ) : (
                    <button className={styles.stopButton} type="button" onClick={() => void stopRecording()}>
                      <Square size={20} fill="currentColor" /> أوقف التسجيل
                    </button>
                  )}
                  {audioUrl && (
                    <div className={styles.audioReview}>
                      <audio controls src={audioUrl} />
                      <button type="button" onClick={() => { replaceAudio(null); setDurationMs(null); }}>
                        <RotateCcw size={16} /> إعادة التسجيل
                      </button>
                    </div>
                  )}
                </div>

                {audioQuality && (
                  <div className={styles.qualityNote} data-state={audioQuality.state}>
                    <strong>{qualityMessage(audioQuality)}</strong>
                    <small>مؤشرات جودة الصوت للتنبيه فقط، وليست تقييمًا لنطق الطفل.</small>
                  </div>
                )}

                {providerStatus && (
                  <div className={styles.readinessNote}>
                    {selected.pronunciationAssessment
                      ? (providerStatus.pronunciation.configured
                        ? "Azure ASR وPronunciation Assessment جاهزان لهذا الهدف المشكول."
                        : "Pronunciation Assessment غير جاهز؛ لا نرسل الهدف الذي يحتاج دليل نطق حتى يكتمل المزود.")
                      : (providerStatus.lexical.configured
                        ? "Azure ASR جاهز لتحليل القراءة المباشرة."
                        : "Azure ASR غير جاهز بعد.")}
                  </div>
                )}
                <button
                  className={styles.analyzeButton}
                  type="button"
                  disabled={
                    !audioBlob
                    || analyzing
                    || recording
                    || audioBlocked
                    || !participantCode.trim()
                    || !providerStatus?.storage.configured
                    || !providerStatus?.lexical.configured
                    || (selected.pronunciationAssessment && !providerStatus?.pronunciation.configured)
                  }
                  onClick={() => void analyze()}
                >
                  {analyzing ? "جاري تحليل الصوت..." : "حلّل التسجيل الآن"}
                </button>
              </section>

              {result && (
                <section className={styles.results}>
                  <div className={styles.resultHero}>
                    <div>
                      <span>قرار النموذج التجريبي — محفوظ تلقائيًا</span>
                      <h2>{decisionLabel[result.decision.state]}</h2>
                      <small>{decisionReasonLabel[result.decision.reason] || "يحتاج مراجعة الأدلة الصوتية"}</small>
                      <p className={styles.resultDisclaimer}>هذا ليس حكمًا نهائيًا على قراءة الطفل.</p>
                    </div>
                    {result.speechMode !== "targeted_pronunciation" && result.reading.lexicalAccuracy != null && (
                      <div className={styles.accuracyCircle}>
                        <strong>{percent01(result.reading.lexicalAccuracy)}</strong>
                        <span>تطابق الكلمات فقط</span>
                      </div>
                    )}
                  </div>

                  <article className={styles.evidenceCard}>
                    <span>ما الذي فهمه Azure من التسجيل؟</span>
                    <h3 dir="auto">{result.asr.transcript || "لم يتعرف Azure على نص"}</h3>
                    {result.asr.confidence != null && <p>ثقة التفريغ: {percent01(result.asr.confidence)} — ليست دقة نطق الطفل</p>}
                    {asrErrorMessage(result.asr.error) && <p>{asrErrorMessage(result.asr.error)}</p>}
                    {result.alias.matched && (
                      <div className={styles.aliasNote}>
                        <strong>تهجئة بديلة محتملة: {result.alias.matchedAlias}</strong>
                        {result.alias.matchKind === "chinese_phonetic_hypothesis" ? (
                          <p>
                            تفريغ صيني قد يشبه الصوت (Pinyin: {result.alias.pinyin || "—"}).
                            {result.alias.evidenceSource === "pinyin_candidate" ? " فرضية لغوية غير مجرّبة بعد على هذا الحرف." : " سبق رصدها في تجربة."}
                            {" "}ليس دليلًا على صحة الحركة العربية أو المد.
                          </p>
                        ) : (
                          <p>هذه كتابة قد تمثّل اسم الحرف أو المد. لا تثبت صحة الحركة القصيرة؛ استمع إلى التسجيل لتقييم الطفل.</p>
                        )}
                      </div>
                    )}
                  </article>

                  {result.pronunciation && (
                    <details className={styles.rawEvidence}>
                      <summary>عرض مؤشرات Azure لتقييم النطق (أدلة فنية وليست نتيجة نهائية)</summary>
                      <div className={styles.metrics}>
                        <div><span>Pronunciation</span><strong>{percent100(result.pronunciation.pronunciationScore)}</strong></div>
                        <div><span>Accuracy</span><strong>{percent100(result.pronunciation.accuracyScore)}</strong></div>
                        <div><span>Fluency</span><strong>{percent100(result.pronunciation.fluencyScore)}</strong></div>
                        <div><span>Completeness</span><strong>{percent100(result.pronunciation.completenessScore)}</strong></div>
                      </div>
                      <p className={styles.reviewExplanation}>قد لا يميّز Azure الحركة القصيرة في حرف منفرد. هذه الدرجات ليست حكمًا آليًا بصحة النطق.</p>
                      {result.pronunciation.error && <p>{result.pronunciation.error}</p>}
                    </details>
                  )}

                  <article className={styles.feedbackCard}>
                    <div>
                      <span>مراجعة هذا التسجيل · لا أثر أكاديمي</span>
                      <h3>استمع إلى التسجيل، ثم قيّم النطق والتحليل والقرار</h3>
                      <p className={styles.reviewExplanation}>نتيجة Azure وقرار النموذج محفوظان تلقائيًا. تقييمك مستقل عنهما ولا يغيّر قرار الطفل أكاديميًا.</p>
                    </div>

                    <div className={styles.reviewGroup}>
                      <strong className={styles.reviewHeading}>1. هل نطق الطفل الهدف بشكل صحيح؟</strong>
                      <div className={styles.verdictButtons}>
                        <button aria-pressed={feedbackVerdict === "correct"} className={feedbackVerdict === "correct" ? styles.selectedGood : ""} onClick={() => { setFeedbackVerdict("correct"); setFeedbackSaved(false); }} type="button">النطق صحيح</button>
                        <button aria-pressed={feedbackVerdict === "incorrect"} className={feedbackVerdict === "incorrect" ? styles.selectedBad : ""} onClick={() => { setFeedbackVerdict("incorrect"); setFeedbackSaved(false); }} type="button">النطق خطأ</button>
                        <button aria-pressed={feedbackVerdict === "unclear"} className={feedbackVerdict === "unclear" ? styles.selectedNeutral : ""} onClick={() => { setFeedbackVerdict("unclear"); setFeedbackSaved(false); }} type="button">غير واضح</button>
                      </div>
                      {feedbackVerdict === "incorrect" && (
                        <label><span>ما الذي نطقه الطفل فعليًا؟ (اختياري)</span>
                          <input value={observedText} onChange={(event) => { setObservedText(event.target.value); setFeedbackSaved(false); }} maxLength={500} placeholder="مثال: لِ بدل لَ" />
                        </label>
                      )}
                      {feedbackVerdict && (
                        <label><span>ملاحظة على النطق (اختيارية)</span>
                          <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setFeedbackSaved(false); }} maxLength={1500} placeholder="مثل: مدّ الحركة أو بدّل الفتحة بالكسرة" />
                        </label>
                      )}
                    </div>

                    <div className={styles.reviewGroup}>
                      <strong className={styles.reviewHeading}>2. هل تفريغ Azure مطابق لما نُطق؟</strong>
                      <div className={styles.verdictButtons}>
                        <button aria-pressed={providerVerdict === "accurate"} className={providerVerdict === "accurate" ? styles.selectedGood : ""} onClick={() => { setProviderVerdict("accurate"); setFeedbackSaved(false); }} type="button">مطابق</button>
                        <button aria-pressed={providerVerdict === "inaccurate"} className={providerVerdict === "inaccurate" ? styles.selectedBad : ""} onClick={() => { setProviderVerdict("inaccurate"); setFeedbackSaved(false); }} type="button">غير مطابق</button>
                        <button aria-pressed={providerVerdict === "unclear"} className={providerVerdict === "unclear" ? styles.selectedNeutral : ""} onClick={() => { setProviderVerdict("unclear"); setFeedbackSaved(false); }} type="button">غير متأكد</button>
                      </div>
                      {providerVerdict === "inaccurate" && (
                        <label><span>ماذا سمعت بدل تفريغ Azure؟ (اختياري)</span>
                          <input value={providerObservedText} onChange={(event) => { setProviderObservedText(event.target.value); setFeedbackSaved(false); }} maxLength={500} placeholder="التفريغ الصحيح حسب سماعك" />
                        </label>
                      )}
                      {providerVerdict && (
                        <label><span>ملاحظة عن Azure (اختيارية)</span>
                          <textarea value={providerNotes} onChange={(event) => { setProviderNotes(event.target.value); setFeedbackSaved(false); }} maxLength={1500} placeholder="مثال: كتب لا بدل لَ أو أخطأ في تقييم الحركة" />
                        </label>
                      )}
                    </div>

                    <div className={styles.reviewGroup}>
                      <strong className={styles.reviewHeading}>3. هل قرار النموذج مناسب؟</strong>
                      <p className={styles.reviewExplanation}>قراره: {decisionLabel[result.decision.state]}. قد تكون المراجعة مناسبة حتى لو كان نطق الطفل صحيحًا، عند ضعف الأدلة.</p>
                      <div className={styles.verdictButtons}>
                        <button aria-pressed={modelVerdict === "appropriate"} className={modelVerdict === "appropriate" ? styles.selectedGood : ""} onClick={() => { setModelVerdict("appropriate"); setFeedbackSaved(false); }} type="button">قرار مناسب</button>
                        <button aria-pressed={modelVerdict === "inappropriate"} className={modelVerdict === "inappropriate" ? styles.selectedBad : ""} onClick={() => { setModelVerdict("inappropriate"); setFeedbackSaved(false); }} type="button">قرار غير مناسب</button>
                        <button aria-pressed={modelVerdict === "unclear"} className={modelVerdict === "unclear" ? styles.selectedNeutral : ""} onClick={() => { setModelVerdict("unclear"); setFeedbackSaved(false); }} type="button">غير متأكد</button>
                      </div>
                      {modelVerdict === "inappropriate" && (
                        <label><span>لماذا القرار غير مناسب؟ (اختياري)</span>
                          <textarea value={modelNotes} onChange={(event) => { setModelNotes(event.target.value); setFeedbackSaved(false); }} maxLength={1500} placeholder="مثل: طلب إعادة رغم وجود دليل كافٍ" />
                        </label>
                      )}
                    </div>

                    <button className={styles.saveFeedback} disabled={(!feedbackVerdict && !providerVerdict && !modelVerdict) || savingFeedback || feedbackSaved} onClick={() => void saveFeedback()} type="button">
                      {feedbackSaved ? <><CheckCircle2 size={18}/> حُفظ تقييم هذا التسجيل</> : <><Save size={18}/> {savingFeedback ? "جاري حفظ التقييم..." : "احفظ التقييمات المحددة"}</>}
                    </button>
                    <p className={styles.reviewExplanation}>يفضّل تقييم الثلاثة لكل تسجيل. ويمكن حفظ أحدها دون مسح البقية.</p>
                  </article>

                  <details className={styles.rawEvidence}>
                    <summary>تفاصيل تقنية للباحث: مقارنة الكلمات ومؤشرات الصوت والبيانات الخام</summary>
                    {result.speechMode !== "targeted_pronunciation" && (
                      <>
                        <div className={styles.metrics}>
                          <div><span>صحيح C</span><strong>{result.reading.correct ?? "—"}</strong></div>
                          <div><span>حذف D</span><strong>{result.reading.deletion ?? "—"}</strong></div>
                          <div><span>إضافة I</span><strong>{result.reading.insertion ?? "—"}</strong></div>
                          <div><span>استبدال S</span><strong>{result.reading.substitution ?? "—"}</strong></div>
                          <div><span>WER</span><strong>{percent01(result.reading.wer)}</strong></div>
                        </div>
                        <div className={styles.alignmentTable}>
                          {result.reading.alignment.map((row, index) => (
                            <div key={index}>
                              <span>{row.reference || "—"}</span>
                              <span>{row.observed || "—"}</span>
                              <b data-kind={row.status}>{alignmentLabel[row.status] || row.status}</b>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                  </details>
                </section>
              )}
            </>
          ) : <div className={styles.empty}>جاري تحميل حالات الاختبار...</div>}
        </div>
      </section>
    </main>
  );
}
