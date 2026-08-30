"use client";

import { Check, CircleHelp, X } from "lucide-react";
import { OBSERVED_MARKS, UnitAnnotation, displayObservedUnit } from "@/lib/calibration";

export function UnitAnnotationEditor({ value, onChange }: { value: UnitAnnotation[]; onChange: (next: UnitAnnotation[]) => void }) {
  const patch = (index: number, changes: Partial<UnitAnnotation>) => {
    onChange(value.map((unit) => unit.index === index ? { ...unit, ...changes } : unit));
  };

  if (!value.length) return null;

  return (
    <div className="unit-annotation-editor">
      <div className="unit-editor-heading">
        <strong>حدد موضع الخطأ داخل النطق</strong>
        <span>هذا يجعلنا نعرف هل الخطأ في الحرف نفسه أم في الحركة أو الشدة.</span>
      </div>
      <div className="unit-editor-list">
        {value.map((unit) => (
          <div className={`unit-editor-card unit-${unit.verdict}`} key={`${unit.index}-${unit.expectedLetter}`}>
            <div className="unit-editor-top">
              <div className="unit-expected"><span>المطلوب</span><strong>{unit.expectedLetter}</strong><small>{unit.expectedMarks.length ? unit.expectedMarks.join(" + ") : "بدون حركة"}</small></div>
              <div className="unit-verdict-buttons" aria-label={`تقييم الوحدة ${unit.index + 1}`}>
                <button type="button" className={unit.verdict === "correct" ? "active good" : ""} onClick={() => patch(unit.index, { verdict: "correct", observedLetter: unit.expectedLetter, observedMark: unit.expectedMarks.find((mark) => ["فتحة", "كسرة", "ضمة", "سكون"].includes(mark)) || "بدون حركة", observedShadda: unit.expectedMarks.includes("شدة") })}><Check size={16} /> صحيح</button>
                <button type="button" className={unit.verdict === "incorrect" ? "active bad" : ""} onClick={() => patch(unit.index, { verdict: "incorrect" })}><X size={16} /> خطأ</button>
                <button type="button" className={unit.verdict === "unsure" ? "active unsure" : ""} onClick={() => patch(unit.index, { verdict: "unsure" })}><CircleHelp size={16} /> غير متأكد</button>
              </div>
            </div>

            {unit.verdict !== "correct" && (
              <div className="unit-observed-grid">
                <label>
                  <span>الحرف الذي سمعته</span>
                  <input value={unit.observedLetter} maxLength={4} onChange={(event) => patch(unit.index, { observedLetter: event.target.value })} placeholder="مثال: ت" />
                </label>
                <label>
                  <span>الحركة التي سمعتها</span>
                  <select value={unit.observedMark} onChange={(event) => patch(unit.index, { observedMark: event.target.value })}>
                    {OBSERVED_MARKS.map((mark) => <option key={mark} value={mark}>{mark}</option>)}
                  </select>
                </label>
                <label className="unit-shadda-toggle">
                  <span>هل سمعت شدة؟</span>
                  <select value={unit.observedShadda == null ? "unsure" : unit.observedShadda ? "yes" : "no"} onChange={(event) => patch(unit.index, { observedShadda: event.target.value === "unsure" ? null : event.target.value === "yes" })}>
                    <option value="no">لا</option>
                    <option value="yes">نعم</option>
                    <option value="unsure">غير متأكد</option>
                  </select>
                </label>
                <div className="unit-observed-preview"><span>المسموع</span><strong>{displayObservedUnit(unit)}</strong></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
