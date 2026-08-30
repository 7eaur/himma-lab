import { NextResponse } from "next/server";
import { findTarget } from "@/lib/targets";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase";
import { transcribeAzure } from "@/lib/azure";
import { analyzeReading, compareHumanPronunciation } from "@/lib/analysis";
import {
  CONFIDENCES,
  ERROR_CATEGORIES,
  UNSURE_REASONS,
  VALIDITIES,
  sanitizeUnitAnnotations,
  unitAnnotationErrorTypes,
} from "@/lib/calibration";

const allowedVerdicts = new Set(["correct", "incorrect", "unsure"]);

export const runtime = "nodejs";

function optionalFiniteNumber(value: FormDataEntryValue | null, min?: number, max?: number) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (min != null && number < min) return null;
  if (max != null && number > max) return null;
  return number;
}

function parseJson(value: FormDataEntryValue | null) {
  try { return JSON.parse(String(value || "[]")); } catch { return []; }
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة على الخادم." }, { status: 503 });

  const form = await request.formData();
  const audio = form.get("audio");
  const participantCode = String(form.get("participantCode") || "").trim().toUpperCase();
  const targetKey = String(form.get("targetKey") || "").trim();
  const verdict = String(form.get("verdict") || "").trim();
  const observedText = String(form.get("observedText") || "").trim();
  const validity = String(form.get("validity") || "valid").trim();
  const confidence = String(form.get("confidence") || "medium").trim();
  const errorCategory = String(form.get("errorCategory") || "").trim();
  const unsureReason = String(form.get("unsureReason") || "").trim();
  const notes = String(form.get("notes") || "").trim();
  const unitAnnotations = sanitizeUnitAnnotations(parseJson(form.get("unitAnnotations")));
  const durationMs = optionalFiniteNumber(form.get("durationMs"), 0);
  const decodedDurationMs = optionalFiniteNumber(form.get("decodedDurationMs"), 0);
  const rms = optionalFiniteNumber(form.get("rms"), 0, 1);
  const peak = optionalFiniteNumber(form.get("peak"), 0, 1);
  const silenceRatio = optionalFiniteNumber(form.get("silenceRatio"), 0, 1);
  const target = findTarget(targetKey);

  if (!(audio instanceof Blob) || audio.size < 800) return NextResponse.json({ detail: "التسجيل فارغ أو غير صالح." }, { status: 422 });
  if (!participantCode) return NextResponse.json({ detail: "كود المشارك مطلوب." }, { status: 422 });
  if (!target) return NextResponse.json({ detail: "هدف المعايرة غير معروف." }, { status: 422 });
  if (!allowedVerdicts.has(verdict)) return NextResponse.json({ detail: "وسم النطق غير صالح." }, { status: 422 });
  if (!VALIDITIES.includes(validity as (typeof VALIDITIES)[number])) return NextResponse.json({ detail: "حالة صلاحية التسجيل غير صالحة." }, { status: 422 });
  if (!CONFIDENCES.includes(confidence as (typeof CONFIDENCES)[number])) return NextResponse.json({ detail: "ثقة الوسم غير صالحة." }, { status: 422 });
  if (errorCategory && !ERROR_CATEGORIES.includes(errorCategory as (typeof ERROR_CATEGORIES)[number])) return NextResponse.json({ detail: "فئة الخطأ غير صالحة." }, { status: 422 });
  if (unsureReason && !UNSURE_REASONS.includes(unsureReason as (typeof UNSURE_REASONS)[number])) return NextResponse.json({ detail: "سبب عدم التأكد غير صالح." }, { status: 422 });
  if (verdict === "incorrect" && (!observedText || !errorCategory)) return NextResponse.json({ detail: "عند اختيار خطأ، حدد نوع الخطأ وما الذي سُمِع." }, { status: 422 });
  if (verdict === "unsure" && !unsureReason) return NextResponse.json({ detail: "حدد سبب عدم التأكد." }, { status: 422 });

  const { data: participant, error: participantError } = await supabase
    .from("calibration_participants")
    .select("id,code,is_active,dataset_split")
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
  const humanErrorTypes = Array.from(new Set([...human.errorTypes, ...unitAnnotationErrorTypes(unitAnnotations)]));
  const quality = validity === "valid" ? "good" : validity;

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
      client_duration_ms: durationMs == null ? null : Math.round(durationMs),
      client_decoded_duration_ms: decodedDurationMs == null ? null : Math.round(decodedDurationMs),
      client_rms: rms,
      client_peak: peak,
      client_silence_ratio: silenceRatio,
      self_verdict: verdict,
      self_observed_text: observedText || null,
      self_quality: quality,
      self_validity: validity,
      self_confidence: confidence,
      self_error_category: errorCategory || null,
      self_unsure_reason: unsureReason || null,
      self_unit_annotations: unitAnnotations,
      self_notes: notes || null,
      dataset_split: participant.dataset_split || "unassigned",
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
      human_error_types: humanErrorTypes,
      calibration_state: "not_calibrated",
      analysis_version: "reference-guided-v2",
      academic_effect: "none",
    })
    .select("id")
    .single();

  if (sampleError) {
    await supabase.storage.from(RECORDINGS_BUCKET).remove([storagePath]);
    return NextResponse.json({ detail: "تعذر حفظ بيانات العينة." }, { status: 500 });
  }

  // Participant-facing response intentionally contains no ASR/calibration results.
  // Full analysis remains stored server-side for supervisor review and analytics only.
  return NextResponse.json({
    sampleId: sample.id,
    saved: true,
  }, { status: 201 });
}
