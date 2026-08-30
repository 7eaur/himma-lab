import { NextResponse } from "next/server";
import { findTarget } from "@/lib/targets";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase";
import { transcribeAzure } from "@/lib/azure";
import { analyzeReading, compareHumanPronunciation } from "@/lib/analysis";

const allowedVerdicts = new Set(["correct", "incorrect", "unsure"]);
const allowedQuality = new Set(["good", "noisy", "too_short", "silence", "unclear"]);

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة على الخادم." }, { status: 503 });

  const form = await request.formData();
  const audio = form.get("audio");
  const participantCode = String(form.get("participantCode") || "").trim().toUpperCase();
  const targetKey = String(form.get("targetKey") || "").trim();
  const verdict = String(form.get("verdict") || "").trim();
  const observedText = String(form.get("observedText") || "").trim();
  const quality = String(form.get("quality") || "good").trim();
  const notes = String(form.get("notes") || "").trim();
  const durationMs = Number(form.get("durationMs") || 0);
  const target = findTarget(targetKey);

  if (!(audio instanceof Blob) || audio.size < 800) return NextResponse.json({ detail: "التسجيل فارغ أو غير صالح." }, { status: 422 });
  if (!participantCode) return NextResponse.json({ detail: "كود المشارك مطلوب." }, { status: 422 });
  if (!target) return NextResponse.json({ detail: "هدف المعايرة غير معروف." }, { status: 422 });
  if (!allowedVerdicts.has(verdict)) return NextResponse.json({ detail: "وسم النطق غير صالح." }, { status: 422 });
  if (!allowedQuality.has(quality)) return NextResponse.json({ detail: "وسم جودة التسجيل غير صالح." }, { status: 422 });
  if (verdict === "incorrect" && !observedText) return NextResponse.json({ detail: "حدد ما الذي سُمِع عند وسم العينة كخطأ." }, { status: 422 });

  const { data: participant, error: participantError } = await supabase
    .from("calibration_participants")
    .select("id,code,is_active")
    .eq("code", participantCode)
    .maybeSingle();

  if (participantError) return NextResponse.json({ detail: "تعذر التحقق من كود المشارك." }, { status: 500 });
  if (!participant?.is_active) return NextResponse.json({ detail: "كود المشارك غير موجود أو غير مفعّل." }, { status: 403 });

  const extension = audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : "webm";
  const storagePath = `${participant.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const audioBuffer = Buffer.from(await audio.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(RECORDINGS_BUCKET).upload(storagePath, audioBuffer, {
    contentType: audio.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ detail: "تعذر رفع التسجيل إلى التخزين." }, { status: 500 });

  const azure = await transcribeAzure(audio, target.text);
  const reading = analyzeReading(target.text, azure.transcript);
  const human = observedText ? compareHumanPronunciation(target.text, observedText) : { observedUnits: [], errorTypes: [] };

  const { data: sample, error: sampleError } = await supabase
    .from("calibration_samples")
    .insert({
      participant_id: participant.id,
      target_key: target.key,
      target_text: target.text,
      target_type: target.type,
      target_group: target.group,
      storage_path: storagePath,
      mime_type: audio.type || "application/octet-stream",
      byte_size: audio.size,
      client_duration_ms: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null,
      self_verdict: verdict,
      self_observed_text: observedText || null,
      self_quality: quality,
      self_notes: notes || null,
      asr_provider: azure.configured ? azure.provider : null,
      asr_locale: azure.configured ? azure.locale : null,
      asr_transcript: azure.transcript,
      asr_confidence: azure.confidence,
      asr_duration_seconds: azure.durationSeconds,
      asr_words: azure.words,
      asr_request_id: azure.requestId,
      asr_error: azure.error,
      normalized_reference: reading.normalizedReference,
      normalized_transcript: reading.normalizedTranscript,
      alignment: reading.alignment,
      correct_count: reading.correct,
      deletion_count: reading.deletion,
      insertion_count: reading.insertion,
      substitution_count: reading.substitution,
      wer: reading.wer,
      lexical_accuracy: reading.lexicalAccuracy,
      pronunciation_reference: reading.pronunciationReference,
      human_observed_units: human.observedUnits,
      human_error_types: human.errorTypes,
      calibration_state: "not_calibrated",
      analysis_version: "reference-guided-v1",
      academic_effect: "none",
    })
    .select("id")
    .single();

  if (sampleError) {
    await supabase.storage.from(RECORDINGS_BUCKET).remove([storagePath]);
    return NextResponse.json({ detail: "تعذر حفظ بيانات العينة." }, { status: 500 });
  }

  return NextResponse.json({
    sampleId: sample.id,
    azureConfigured: azure.configured,
    azureError: azure.error,
    analysis: {
      transcript: azure.transcript,
      confidence: azure.confidence,
      correct: reading.correct,
      deletion: reading.deletion,
      insertion: reading.insertion,
      substitution: reading.substitution,
      wer: reading.wer,
      lexicalAccuracy: reading.lexicalAccuracy,
      calibrationState: "not_calibrated",
    },
  }, { status: 201 });
}
