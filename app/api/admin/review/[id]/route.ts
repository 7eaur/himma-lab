import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";
import { compareHumanPronunciation } from "@/lib/analysis";
import {
  CONFIDENCES,
  ERROR_CATEGORIES,
  UNSURE_REASONS,
  VALIDITIES,
  sanitizeUnitAnnotations,
  unitAnnotationErrorTypes,
} from "@/lib/calibration";

const verdicts = new Set(["correct", "incorrect", "unsure", "invalid"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ detail: "غير مصرح." }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    verdict?: string;
    observedText?: string;
    validity?: string;
    confidence?: string;
    errorCategory?: string;
    unsureReason?: string;
    unitAnnotations?: unknown;
    notes?: string;
    reviewerSlot?: number;
  } | null;

  const verdict = String(body?.verdict || "");
  const validity = String(body?.validity || "valid");
  const confidence = String(body?.confidence || "medium");
  const errorCategory = String(body?.errorCategory || "").trim();
  const unsureReason = String(body?.unsureReason || "").trim();
  const observedText = String(body?.observedText || "").trim();
  const reviewerSlot = Number(body?.reviewerSlot || 1);
  const unitAnnotations = sanitizeUnitAnnotations(body?.unitAnnotations);

  if (!verdicts.has(verdict)) return NextResponse.json({ detail: "حكم المراجعة غير صالح." }, { status: 422 });
  if (!VALIDITIES.includes(validity as (typeof VALIDITIES)[number])) return NextResponse.json({ detail: "صلاحية التسجيل غير صالحة." }, { status: 422 });
  if (!CONFIDENCES.includes(confidence as (typeof CONFIDENCES)[number])) return NextResponse.json({ detail: "ثقة المراجع غير صالحة." }, { status: 422 });
  if (errorCategory && !ERROR_CATEGORIES.includes(errorCategory as (typeof ERROR_CATEGORIES)[number])) return NextResponse.json({ detail: "فئة الخطأ غير صالحة." }, { status: 422 });
  if (unsureReason && !UNSURE_REASONS.includes(unsureReason as (typeof UNSURE_REASONS)[number])) return NextResponse.json({ detail: "سبب عدم التأكد غير صالح." }, { status: 422 });
  if (verdict === "incorrect" && (!observedText || !errorCategory)) return NextResponse.json({ detail: "عند اختيار خطأ، حدد نوع الخطأ وما الذي سمعه المراجع." }, { status: 422 });
  if (verdict === "unsure" && !unsureReason) return NextResponse.json({ detail: "حدد سبب عدم التأكد." }, { status: 422 });
  if (![1, 2, 3].includes(reviewerSlot)) return NextResponse.json({ detail: "خانة المراجع غير صالحة." }, { status: 422 });

  const { data: sample } = await supabase.from("calibration_samples").select("target_text").eq("id", id).maybeSingle();
  if (!sample) return NextResponse.json({ detail: "العينة غير موجودة." }, { status: 404 });

  const human = observedText ? compareHumanPronunciation(sample.target_text, observedText) : { observedUnits: [], errorTypes: [] };
  const errorTypes = Array.from(new Set([...human.errorTypes, ...unitAnnotationErrorTypes(unitAnnotations)]));
  const quality = validity === "valid" ? "good" : validity;

  const { error } = await supabase.from("calibration_reviews").upsert({
    sample_id: id,
    reviewer_slot: reviewerSlot,
    verdict,
    observed_text: observedText || null,
    quality,
    validity,
    reviewer_confidence: confidence,
    error_category: errorCategory || null,
    unsure_reason: unsureReason || null,
    unit_annotations: unitAnnotations,
    notes: String(body?.notes || "").trim() || null,
    observed_units: human.observedUnits,
    error_types: errorTypes,
  }, { onConflict: "sample_id,reviewer_slot" });

  if (error) return NextResponse.json({ detail: "تعذر حفظ المراجعة." }, { status: 400 });
  return NextResponse.json({ ok: true, errorTypes });
}
