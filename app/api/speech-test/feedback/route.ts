import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const allowedVerdicts = new Set(["correct", "incorrect", "unclear"]);

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const participantCode = String(body?.participantCode || "").trim().toUpperCase();
  const runId = String(body?.runId || "").trim();
  const verdict = String(body?.verdict || "").trim();
  const observedText = String(body?.observedText || "").trim();
  const notes = String(body?.notes || "").trim();

  if (!participantCode || !runId || !allowedVerdicts.has(verdict)) {
    return NextResponse.json({ detail: "بيانات التقييم غير مكتملة." }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("speech_experiment_runs")
    .update({
      feedback_verdict: verdict,
      feedback_observed_text: observedText || null,
      feedback_notes: notes || null,
      feedback_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("participant_code", participantCode)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ detail: "تعذر حفظ تقييم التجربة." }, { status: 500 });
  if (!data) return NextResponse.json({ detail: "نتيجة التجربة غير موجودة." }, { status: 404 });
  return NextResponse.json({ saved: true });
}
