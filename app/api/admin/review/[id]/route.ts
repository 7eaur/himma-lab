import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";

const verdicts = new Set(["correct", "incorrect", "unsure", "invalid"]);
const qualities = new Set(["good", "noisy", "too_short", "silence", "unclear", "corrupt"]);
const confidences = new Set(["high", "medium", "low"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ detail: "غير مصرح." }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { verdict?: string; observedText?: string; quality?: string; confidence?: string; notes?: string; reviewerSlot?: number } | null;
  const verdict = String(body?.verdict || "");
  const quality = String(body?.quality || "good");
  const confidence = String(body?.confidence || "medium");
  const observedText = String(body?.observedText || "").trim();
  const reviewerSlot = Number(body?.reviewerSlot || 1);

  if (!verdicts.has(verdict) || !qualities.has(quality) || !confidences.has(confidence)) return NextResponse.json({ detail: "بيانات المراجعة غير صالحة." }, { status: 422 });
  if (verdict === "incorrect" && !observedText) return NextResponse.json({ detail: "حدد ما الذي سمعه المراجع عند اختيار خطأ." }, { status: 422 });
  if (![1, 2, 3].includes(reviewerSlot)) return NextResponse.json({ detail: "خانة المراجع غير صالحة." }, { status: 422 });

  const { error } = await supabase.from("calibration_reviews").upsert({
    sample_id: id,
    reviewer_slot: reviewerSlot,
    verdict,
    observed_text: observedText || null,
    quality,
    reviewer_confidence: confidence,
    notes: String(body?.notes || "").trim() || null,
  }, { onConflict: "sample_id,reviewer_slot" });

  if (error) return NextResponse.json({ detail: "تعذر حفظ المراجعة." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
