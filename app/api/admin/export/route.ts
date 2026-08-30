import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ detail: "غير مصرح." }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة." }, { status: 503 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const { data: samples, error } = await supabase
    .from("calibration_samples")
    .select("*, calibration_participants(code,label), calibration_reviews(*)")
    .order("created_at", { ascending: true })
    .limit(10000);

  if (error) return NextResponse.json({ detail: "تعذر تصدير البيانات." }, { status: 500 });

  if (format === "json") {
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), academicEffect: "none", calibrationState: "not_calibrated", samples: samples || [] }, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="himma-calibration-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
    });
  }

  const columns = [
    "id","participant_code","participant_label","target_key","target_text","target_type","target_group","client_duration_ms","self_verdict","self_observed_text","self_quality","self_notes","asr_provider","asr_locale","asr_transcript","asr_confidence","asr_duration_seconds","normalized_reference","normalized_transcript","correct_count","deletion_count","insertion_count","substitution_count","wer","lexical_accuracy","human_error_types","calibration_state","analysis_version","academic_effect","created_at","reviews"
  ];
  const rows = (samples || []).map((sample) => [
    sample.id,
    sample.calibration_participants?.code,
    sample.calibration_participants?.label,
    sample.target_key,
    sample.target_text,
    sample.target_type,
    sample.target_group,
    sample.client_duration_ms,
    sample.self_verdict,
    sample.self_observed_text,
    sample.self_quality,
    sample.self_notes,
    sample.asr_provider,
    sample.asr_locale,
    sample.asr_transcript,
    sample.asr_confidence,
    sample.asr_duration_seconds,
    sample.normalized_reference,
    sample.normalized_transcript,
    sample.correct_count,
    sample.deletion_count,
    sample.insertion_count,
    sample.substitution_count,
    sample.wer,
    sample.lexical_accuracy,
    sample.human_error_types,
    sample.calibration_state,
    sample.analysis_version,
    sample.academic_effect,
    sample.created_at,
    sample.calibration_reviews,
  ]);
  const csv = `\uFEFF${columns.join(",")}\n${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="himma-calibration-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
