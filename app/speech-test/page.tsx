"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Mic, RotateCcw, Save, Square, TestTube2 } from "lucide-react";
import { PcmWavRecorder } from "@/lib/pcm-wav-recorder";
import styles from "./speech-test.module.css";

type SpeechMode = "targeted_pronunciation" | "lexical" | "fluency";
type TestCase = {
  key: string;
  label: string;
  text: string;
  mode: SpeechMode;
  focus: string | null;
};

type ProviderStatus = {
  lexical: { provider: string; configured: boolean; locale: string };
  pronunciation: { provider: string; configured: boolean; locale: string };
  storage: { configured: boolean };
  academicEffect: "none";
};

type AnalysisResult = {
  runId: string;
  createdAt: string;
  label: string;
  speechMode: SpeechMode;
  pronunciationFocus: string | null;
  referenceText: string;
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
    effect: string | null;
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

const modeLabel: Record<SpeechMode, string> = {
  targeted_pronunciation: "نطق مستهدف",
  lexical: "قراءة نصية",
  fluency: "طلاقة",
};

const decisionLabel = {
  correct: "صحيح",
  incorrect: "خطأ",
  retry_required: "يحتاج إعادة / دليل إضافي",
} as const;

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

export default function SpeechTestPage() {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [participantCode, setParticipantCode] = useState("HIMMA21");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [message, setMessage] = useState("");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [feedbackVerdict, setFeedbackVerdict] = useState<"correct" | "incorrect" | "unclear" | "">("");
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
  const grouped = useMemo(() => ({
    targeted_pronunciation: cases.filter((item) => item.mode === "targeted_pronunciation"),
    lexical: cases.filter((item) => item.mode === "lexical"),
    fluency: cases.filter((item) => item.mode === "fluency"),
  }), [cases]);

  const resetResult = () => {
    setResult(null);
    setFeedbackVerdict("");
    setObservedText("");
    setNotes("");
    setFeedbackSaved(false);
  };

  const replaceAudio = (blob: Blob | null) => {
    resetResult();
    setAudioBlob(blob);
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
      replaceAudio(blob);
    } catch {
      recorder.cancel();
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
      if (!response.ok) throw new Error(payload?.detail || "تعذر تحليل التسجيل");
      setResult(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحليل التسجيل");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveFeedback = async () => {
    if (!result || !feedbackVerdict) return;
    setSavingFeedback(true);
    setMessage("");
    try {
      const response = await fetch("/api/speech-test/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantCode: participantCode.trim().toUpperCase(),
          runId: result.runId,
          verdict: feedbackVerdict,
          observedText,
          notes,
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
          {(["targeted_pronunciation", "lexical", "fluency"] as SpeechMode[]).map((mode) => (
            <div className={styles.caseGroup} key={mode}>
              <h3>{modeLabel[mode]}</h3>
              {grouped[mode].map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={item.key === selectedKey ? styles.activeCase : ""}
                  onClick={() => { setSelectedKey(item.key); replaceAudio(null); setMessage(""); }}
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
                    <span className={styles.mode}>{modeLabel[selected.mode]}</span>
                    <h1>{selected.label}</h1>
                  </div>
                  <label className={styles.codeField}>
                    <span>كود التجربة</span>
                    <input value={participantCode} onChange={(event) => setParticipantCode(event.target.value)} />
                  </label>
                </div>

                <div className={styles.reference}>{selected.text}</div>
                <p className={styles.hint}>
                  {selected.mode === "targeted_pronunciation"
                    ? "اقرأ الحرف أو الكلمة كما هي. سنعرض ASR وPronunciation Assessment معًا."
                    : selected.mode === "lexical"
                      ? "اقرأ النص بصورة طبيعية. سنقارن الكلمات بعد إزالة التشكيل."
                      : "اقرأ بصورة طبيعية ومريحة. سنحفظ الدقة والزمن معًا."}
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

                {providerStatus && (
                  <div className={styles.readinessNote}>
                    {selected.mode === "targeted_pronunciation"
                      ? (providerStatus.pronunciation.configured
                        ? "Azure ASR وPronunciation Assessment جاهزان لهذه التجربة."
                        : "Pronunciation Assessment غير جاهز بعد؛ لن نبدأ تجربة الحركات حتى يكتمل إعداد المزود.")
                      : (providerStatus.lexical.configured
                        ? "Azure ASR جاهز لتحليل القراءة النصية."
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
                    || !participantCode.trim()
                    || !providerStatus?.storage.configured
                    || !providerStatus?.lexical.configured
                    || (selected.mode === "targeted_pronunciation" && !providerStatus?.pronunciation.configured)
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
                      <span>قرار النموذج الحالي</span>
                      <h2>{decisionLabel[result.decision.state]}</h2>
                      <small>{result.decision.reason}</small>
                    </div>
                    <div className={styles.accuracyCircle}>
                      <strong>{percent01(result.reading.lexicalAccuracy)}</strong>
                      <span>دقة لفظية</span>
                    </div>
                  </div>

                  <div className={styles.metrics}>
                    <div><span>ثقة ASR</span><strong>{percent01(result.asr.confidence)}</strong></div>
                    <div><span>صحيح C</span><strong>{result.reading.correct ?? "—"}</strong></div>
                    <div><span>حذف D</span><strong>{result.reading.deletion ?? "—"}</strong></div>
                    <div><span>إضافة I</span><strong>{result.reading.insertion ?? "—"}</strong></div>
                    <div><span>استبدال S</span><strong>{result.reading.substitution ?? "—"}</strong></div>
                    <div><span>WER</span><strong>{percent01(result.reading.wer)}</strong></div>
                  </div>

                  <div className={styles.evidenceGrid}>
                    <article className={styles.evidenceCard}>
                      <span>Azure ASR</span>
                      <h3>{result.asr.transcript || "لم يرجع نصًا"}</h3>
                      <p>المرجع بعد التطبيع: {result.reading.normalizedReference || "—"}</p>
                      <p>الناتج بعد التطبيع: {result.reading.normalizedTranscript || "—"}</p>
                      {result.asr.error && <b>خطأ المزود: {result.asr.error}</b>}
                    </article>

                    <article className={styles.evidenceCard}>
                      <span>Alias Evidence</span>
                      <h3>{result.alias.matched ? "تم رصد تهجئة بديلة من ASR" : "لا يوجد Alias مطابق"}</h3>
                      <p>{result.alias.matchedAlias || "—"}</p>
                      <small>الـAlias لا يعطي نجاحًا؛ يمنع الرفض من ASR وحده.</small>
                    </article>
                  </div>

                  {result.pronunciation && (
                    <article className={styles.pronunciationCard}>
                      <div className={styles.pronunciationHeader}>
                        <div>
                          <span>Azure Pronunciation Assessment</span>
                          <h3>{result.pronunciation.locale} · {result.pronunciation.recognitionStatus || "—"}</h3>
                        </div>
                        <div className={styles.pronScore}>
                          <strong>{percent100(result.pronunciation.pronunciationScore)}</strong>
                          <span>Pronunciation</span>
                        </div>
                      </div>
                      <div className={styles.metrics}>
                        <div><span>Accuracy</span><strong>{percent100(result.pronunciation.accuracyScore)}</strong></div>
                        <div><span>Fluency</span><strong>{percent100(result.pronunciation.fluencyScore)}</strong></div>
                        <div><span>Completeness</span><strong>{percent100(result.pronunciation.completenessScore)}</strong></div>
                        <div><span>Confidence</span><strong>{percent01(result.pronunciation.confidence)}</strong></div>
                      </div>
                      <p className={styles.pronTranscript}>تعرف المزود: <strong>{result.pronunciation.transcript || "—"}</strong></p>
                      {result.pronunciation.error && <div className={styles.inlineError}>{result.pronunciation.error}</div>}
                      {result.pronunciation.words.length > 0 && (
                        <div className={styles.wordScores}>
                          {result.pronunciation.words.map((word, index) => (
                            <div key={`${word.word}-${index}`}>
                              <strong>{word.word}</strong>
                              <span>دقة {percent100(word.accuracyScore)}</span>
                              <span>{word.errorType || "NoError"}</span>
                              {word.phonemeScores.length > 0 && <small>Phonemes: {word.phonemeScores.map((score) => Math.round(score)).join(" / ")}</small>}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  )}

                  <article className={styles.alignmentCard}>
                    <h3>المحاذاة C / D / I / S</h3>
                    <div className={styles.alignmentTable}>
                      {result.reading.alignment.length === 0 && <p>لا توجد محاذاة متاحة.</p>}
                      {result.reading.alignment.map((row, index) => (
                        <div key={index}>
                          <span>{row.reference || "—"}</span>
                          <span>{row.observed || "—"}</span>
                          <b data-kind={row.status}>{alignmentLabel[row.status] || row.status}</b>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className={styles.feedbackCard}>
                    <div>
                      <span>تقييمك أنت لهذه النتيجة</span>
                      <h3>هل النموذج حكم بطريقة صحيحة؟</h3>
                    </div>
                    <div className={styles.verdictButtons}>
                      <button className={feedbackVerdict === "correct" ? styles.selectedGood : ""} onClick={() => setFeedbackVerdict("correct")} type="button">النطق صحيح</button>
                      <button className={feedbackVerdict === "incorrect" ? styles.selectedBad : ""} onClick={() => setFeedbackVerdict("incorrect")} type="button">النطق خطأ</button>
                      <button className={feedbackVerdict === "unclear" ? styles.selectedNeutral : ""} onClick={() => setFeedbackVerdict("unclear")} type="button">غير واضح</button>
                    </div>
                    <label>
                      <span>ماذا سمعت؟ (اختياري)</span>
                      <input value={observedText} onChange={(event) => setObservedText(event.target.value)} placeholder="مثال: ما بدل مَ" />
                    </label>
                    <label>
                      <span>ملاحظتك</span>
                      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="هل ASR أخطأ؟ هل درجة النطق تبدو منطقية؟ أي ملاحظة مفيدة..." />
                    </label>
                    <button className={styles.saveFeedback} disabled={!feedbackVerdict || savingFeedback || feedbackSaved} onClick={() => void saveFeedback()} type="button">
                      {feedbackSaved ? <><CheckCircle2 size={18}/> تم حفظ تقييمك</> : <><Save size={18}/> {savingFeedback ? "جاري الحفظ..." : "احفظ التقييم"}</>}
                    </button>
                  </article>

                  <details className={styles.rawEvidence}>
                    <summary>عرض البيانات الخام للتجربة</summary>
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
