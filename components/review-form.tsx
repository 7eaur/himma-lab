"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ShieldCheck } from "lucide-react";
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

type Props = { sampleId: string; targetText: string; targetType: string; contrasts: string[] };
type Verdict = "correct" | "incorrect" | "unsure" | "invalid";

const reviewerValidities: Validity[] = ["valid", "silence", "noisy", "too_short", "unclear", "corrupt"];

export function ReviewForm({ sampleId, targetText, targetType, contrasts }: Props) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<Verdict>("correct");
  const [observedText, setObservedText] = useState(targetText);
  const [validity, setValidity] = useState<Validity>("valid");
  const [confidence, setConfidence] = useState<Confidence>("high");
  const [errorCategory, setErrorCategory] = useState<ErrorCategory | "">("");
  const [unsureReason, setUnsureReason] = useState<UnsureReason | "">("");
  const [unitAnnotations, setUnitAnnotations] = useState<UnitAnnotation[]>(supportsDetailedUnits(targetType) ? createUnitAnnotations(targetText) : []);
  const [notes, setNotes] = useState("");
  const [reviewerSlot, setReviewerSlot] = useState(1);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectVerdict = (next: Verdict) => {
    setVerdict(next);
    setErrorCategory("");
    setUnsureReason("");
    if (next === "correct") {
      setObservedText(targetText);
      if (supportsDetailedUnits(targetType)) setUnitAnnotations(createUnitAnnotations(targetText));
    } else {
      setObservedText("");
    }
  };

  const save = async () => {
    if (verdict === "incorrect" && (!observedText.trim() || !errorCategory)) {
      setMessage("حدد نوع الخطأ وما الذي سمعته قبل الحفظ.");
      return;
    }
    if (verdict === "unsure" && !unsureReason) {
      setMessage("حدد سبب عدم التأكد قبل الحفظ.");
      return;
    }
    if (verdict === "incorrect" && supportsDetailedUnits(targetType) && ["haraka", "letter", "shadda", "sukun", "tanween"].includes(errorCategory) && unitAnnotations.every((unit) => unit.verdict === "correct")) {
      setMessage("حدد موضع الخطأ داخل الوحدات النطقية.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/review/${sampleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, observedText, validity, confidence, errorCategory, unsureReason, unitAnnotations, notes, reviewerSlot }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "تعذر حفظ المراجعة");
      setMessage("تم حفظ Ground Truth للمراجع بالتفاصيل.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ المراجعة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card reviewer-form-card rich-reviewer-form">
      <div className="reviewer-form-heading">
        <ShieldCheck size={22} />
        <div>
          <h2>الحكم البشري المستقل</h2>
          <p>استمع للتسجيل أولًا ثم قيّم صلاحية التسجيل والنطق وما سمعته. لا تنسخ حكم المشارك أو نتيجة Azure تلقائيًا.</p>
        </div>
      </div>

      <label className="label" htmlFor="review-slot">خانة المراجع</label>
      <select id="review-slot" className="select" value={reviewerSlot} onChange={(event) => setReviewerSlot(Number(event.target.value))}>
        <option value={1}>المراجع 1</option>
        <option value={2}>المراجع 2</option>
        <option value={3}>مراجع حاسم</option>
      </select>

      <div className="ground-truth-step compact-step">
        <div className="ground-truth-step-title"><span>1</span><div><strong>صلاحية التسجيل</strong><small>افصل جودة الملف عن صحة النطق.</small></div></div>
        <div className="validity-grid">{reviewerValidities.map((item) => <button type="button" key={item} className={validity === item ? "active" : ""} onClick={() => setValidity(item)}>{VALIDITY_LABELS[item]}</button>)}</div>
      </div>

      <div className="ground-truth-step compact-step">
        <div className="ground-truth-step-title"><span>2</span><div><strong>الحكم على النطق</strong><small>اختر ما سمعته فعلًا.</small></div></div>
        <div className="annotation-grid">
          <button type="button" className={`choice ${verdict === "correct" ? "active" : ""}`} onClick={() => selectVerdict("correct")}>صحيح</button>
          <button type="button" className={`choice ${verdict === "incorrect" ? "active" : ""}`} onClick={() => selectVerdict("incorrect")}>خطأ</button>
          <button type="button" className={`choice ${verdict === "unsure" ? "active" : ""}`} onClick={() => selectVerdict("unsure")}>غير متأكد</button>
          <button type="button" className={`choice ${verdict === "invalid" ? "active" : ""}`} onClick={() => selectVerdict("invalid")}>غير صالح للتقييم</button>
        </div>
      </div>

      {verdict === "incorrect" && <div className="ground-truth-step compact-step nested-step">
        <div className="ground-truth-step-title"><span>3</span><div><strong>نوع الخطأ والمسموع</strong><small>حدد الفئة ثم النطق الذي سمعته.</small></div></div>
        <div className="error-category-grid">{(Object.keys(ERROR_CATEGORY_LABELS) as ErrorCategory[]).map((item) => <button type="button" key={item} className={errorCategory === item ? "active" : ""} onClick={() => setErrorCategory(item)}>{ERROR_CATEGORY_LABELS[item]}</button>)}</div>
        {contrasts.length > 0 && <div className="contrasts">{contrasts.map((contrast) => <button type="button" key={contrast} className={`contrast ${observedText === contrast ? "active" : ""}`} onClick={() => setObservedText(contrast)}>{contrast}</button>)}</div>}
        <input className="input reviewer-observed-input" value={observedText} onChange={(event) => setObservedText(event.target.value)} placeholder="اكتب النطق المسموع" />
      </div>}

      {verdict === "unsure" && <div className="ground-truth-step compact-step nested-step">
        <div className="ground-truth-step-title"><span>3</span><div><strong>سبب عدم التأكد</strong><small>يساعدنا على استبعاد العينات الملتبسة من المعايرة.</small></div></div>
        <div className="error-category-grid">{(Object.keys(UNSURE_REASON_LABELS) as UnsureReason[]).map((item) => <button type="button" key={item} className={unsureReason === item ? "active" : ""} onClick={() => setUnsureReason(item)}>{UNSURE_REASON_LABELS[item]}</button>)}</div>
        <input className="input reviewer-observed-input" value={observedText} onChange={(event) => setObservedText(event.target.value)} placeholder="أقرب نطق سمعته - اختياري" />
      </div>}

      {(verdict === "incorrect" || verdict === "unsure") && supportsDetailedUnits(targetType) && <UnitAnnotationEditor value={unitAnnotations} onChange={setUnitAnnotations} />}

      <label className="label" htmlFor="review-confidence">ثقة المراجع</label>
      <select id="review-confidence" className="select" value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}>{(Object.keys(CONFIDENCE_LABELS) as Confidence[]).map((item) => <option key={item} value={item}>{CONFIDENCE_LABELS[item]}</option>)}</select>

      <label className="label" htmlFor="review-notes">ملاحظات</label>
      <textarea id="review-notes" className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="أي ملاحظة تساعد في الحسم أو المعايرة" />
      <div className="actions"><button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}><Save size={17} /> {saving ? "جاري الحفظ..." : "حفظ المراجعة"}</button></div>
      {message && <div className="status status-info reviewer-message">{message}</div>}
    </div>
  );
}
