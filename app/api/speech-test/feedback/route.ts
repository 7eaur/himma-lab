import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseSpeechFeedback } from "@/lib/speech-feedback";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const parsed = parseSpeechFeedback(body, new Date().toISOString());

  if (!parsed.ok) return NextResponse.json({ detail: parsed.detail }, { status: 422 });

  // The two review dimensions are independent: saving the provider verdict
  // must never clear or overwrite an earlier human child-pronunciation verdict.
  const { data, error } = await supabase
    .from("speech_experiment_runs")
    .update(parsed.patch)
    .eq("id", parsed.runId)
    .eq("participant_code", parsed.participantCode)
    .select("id,feedback_verdict,provider_feedback_verdict")
    .maybeSingle();

  if (error) return NextResponse.json({ detail: "تعذر حفظ تقييم التجربة." }, { status: 500 });
  if (!data) return NextResponse.json({ detail: "نتيجة التجربة غير موجودة." }, { status: 404 });

  return NextResponse.json({
    saved: true,
    childVerdict: data.feedback_verdict,
    providerVerdict: data.provider_feedback_verdict,
  });
}
