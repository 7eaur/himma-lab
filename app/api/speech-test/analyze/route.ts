import { NextResponse } from "next/server";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase";
import { transcribeAzure } from "@/lib/azure";
import { assessAzurePronunciation } from "@/lib/azure-pronunciation";
import { TEST_CASES, decisionPreview } from "@/lib/speech-experiment";

export const runtime = "nodejs";

function finiteNumber(value: FormDataEntryValue | null) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة." }, { status: 503 });

  const form = await request.formData();
  const participantCode = String(form.get("participantCode") || "").trim().toUpperCase();
  const testKey = String(form.get("testKey") || "").trim();
  const audio = form.get("audio");
  const durationMs = finiteNumber(form.get("durationMs"));

  if (!participantCode) return NextResponse.json({ detail: "كود التجربة مطلوب." }, { status: 422 });
  if (!(audio instanceof Blob) || audio.size < 800) return NextResponse.json({ detail: "التسجيل فارغ أو قصير جدًا." }, { status: 422 });

  const testCase = TEST_CASES.find((item) => item.key === testKey);
  if (!testCase) return NextResponse.json({ detail: "حالة الاختبار غير معروفة." }, { status: 422 });

  const { data: participant, error: participantError } = await supabase
    .from("calibration_participants")
    .select("id,code,is_active")
    .eq("code", participantCode)
    .maybeSingle();

  if (participantError) return NextResponse.json({ detail: "تعذر التحقق من كود التجربة." }, { status: 500 });
  if (!participant?.is_active) return NextResponse.json({ detail: "كود التجربة غير صحيح أو غير مفعّل." }, { status: 403 });

  const storagePath = `speech-experiments/${participant.id}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.wav`;
  const bytes = Buffer.from(await audio.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(RECORDINGS_BUCKET).upload(storagePath, bytes, {
    contentType: "audio/wav",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ detail: "تعذر رفع التسجيل." }, { status: 500 });

  const asr = await transcribeAzure(audio, testCase.text);
  const preview = decisionPreview(testCase.mode, testCase.text, asr.transcript);
  const pronunciation = testCase.mode === "targeted_pronunciation"
    ? await assessAzurePronunciation(audio, testCase.text)
    : null;

  const finalPreview = (() => {
    if (testCase.mode !== "targeted_pronunciation") return preview;
    if (!pronunciation?.configured || pronunciation.error || pronunciation.pronunciationScore == null) {
      return { ...preview, state: "retry_required" as const, reason: "pronunciation_evidence_unavailable" };
    }
    return preview;
  })();

  const payload = {
    testKey: testCase.key,
    label: testCase.label,
    speechMode: testCase.mode,
    pronunciationFocus: testCase.focus,
    referenceText: testCase.text,
    asr: {
      configured: asr.configured,
      provider: asr.provider,
      locale: asr.locale,
      transcript: asr.transcript,
      confidence: asr.confidence,
      durationSeconds: asr.durationSeconds,
      words: asr.words,
      requestId: asr.requestId,
      error: asr.error,
    },
    reading: preview.reading,
    alias: preview.alias,
    pronunciation,
    decision: {
      state: finalPreview.state,
      reason: finalPreview.reason,
      academicEffect: "none",
    },
  };

  const { data: run, error: insertError } = await supabase
    .from("speech_experiment_runs")
    .insert({
      participant_code: participantCode,
      test_key: testCase.key,
      speech_mode: testCase.mode,
      pronunciation_focus: testCase.focus,
      reference_text: testCase.text,
      audio_storage_path: storagePath,
      mime_type: "audio/wav",
      byte_size: audio.size,
      duration_ms: durationMs == null ? null : Math.round(durationMs),
      asr_provider: asr.configured ? asr.provider : null,
      asr_locale: asr.configured ? asr.locale : null,
      asr_transcript: asr.transcript,
      asr_confidence: asr.confidence,
      asr_error: asr.error,
      reading_analysis: preview.reading,
      alias_evidence: preview.alias,
      pronunciation_evidence: pronunciation,
      decision_state: finalPreview.state,
      decision_reason: finalPreview.reason,
    })
    .select("id,created_at")
    .single();

  if (insertError || !run) {
    await supabase.storage.from(RECORDINGS_BUCKET).remove([storagePath]);
    return NextResponse.json({ detail: "تعذر حفظ نتيجة التجربة." }, { status: 500 });
  }

  return NextResponse.json({ runId: run.id, createdAt: run.created_at, ...payload }, { status: 201 });
}
