import { NextResponse } from "next/server";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase";
import { transcribeAzure } from "@/lib/azure";
import { assessAzurePronunciation } from "@/lib/azure-pronunciation";
import { analyzePcm16Wav, blocksAnalysis } from "@/lib/audio-quality";
import { TEST_CASES, decisionPreview } from "@/lib/speech-experiment";

export const runtime = "nodejs";

function finiteNumber(value: FormDataEntryValue | null) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function audioQualityMessage(state: string) {
  if (state === "too_short") return "التسجيل قصير جدًا. أعد التسجيل واقرأ الهدف كاملًا.";
  if (state === "silence") return "لم نرصد إشارة صوتية واضحة. اقترب قليلًا من الميكروفون وأعد التسجيل.";
  return "صيغة التسجيل غير صالحة للتحليل. أعد التسجيل.";
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
  if (!(audio instanceof Blob) || audio.size < 800) {
    return NextResponse.json({ detail: "التسجيل فارغ أو قصير جدًا." }, { status: 422 });
  }

  const testCase = TEST_CASES.find((item) => item.key === testKey);
  if (!testCase) return NextResponse.json({ detail: "حالة الاختبار غير معروفة." }, { status: 422 });

  const { data: participant, error: participantError } = await supabase
    .from("calibration_participants")
    .select("id,code,is_active")
    .eq("code", participantCode)
    .maybeSingle();

  if (participantError) return NextResponse.json({ detail: "تعذر التحقق من كود التجربة." }, { status: 500 });
  if (!participant?.is_active) return NextResponse.json({ detail: "كود التجربة غير صحيح أو غير مفعّل." }, { status: 403 });

  const bytes = Buffer.from(await audio.arrayBuffer());
  const audioQuality = analyzePcm16Wav(bytes);
  if (blocksAnalysis(audioQuality)) {
    return NextResponse.json(
      {
        detail: audioQualityMessage(audioQuality.state),
        code: `audio_quality_${audioQuality.state}`,
        audioQuality,
      },
      { status: 422 },
    );
  }

  const storagePath = `speech-experiments/${participant.id}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.wav`;
  const { error: uploadError } = await supabase.storage.from(RECORDINGS_BUCKET).upload(storagePath, bytes, {
    contentType: "audio/wav",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ detail: "تعذر رفع التسجيل." }, { status: 500 });

  const asr = await transcribeAzure(audio, testCase.text, {
    allowNonArabicTranscript: testCase.mode === "targeted_pronunciation",
  });
  const analysisTranscript = asr.usable ? asr.transcript : null;
  const preview = decisionPreview(testCase.mode, testCase.text, analysisTranscript);
  const pronunciation = testCase.mode === "targeted_pronunciation"
    ? await assessAzurePronunciation(audio, testCase.text)
    : null;

  const finalPreview = (() => {
    if (!asr.usable) {
      return {
        ...preview,
        state: "retry_required" as const,
        reason: asr.error || "asr_unusable",
      };
    }

    if (testCase.mode !== "targeted_pronunciation") return preview;
    if (!pronunciation?.configured || pronunciation.error || pronunciation.pronunciationScore == null) {
      return {
        ...preview,
        state: "retry_required" as const,
        reason: "pronunciation_evidence_unavailable",
      };
    }
    return preview;
  })();

  const payload = {
    testKey: testCase.key,
    label: testCase.label,
    speechMode: testCase.mode,
    pronunciationFocus: testCase.focus,
    referenceText: testCase.text,
    audioQuality,
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
      recognitionStatus: asr.recognitionStatus,
      source: asr.source,
      transcriptScript: asr.transcriptScript,
      usable: asr.usable,
      snr: asr.snr,
      diagnostics: asr.diagnostics,
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
      duration_ms: durationMs == null ? Math.round(audioQuality.durationMs || 0) : Math.round(durationMs),
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
      audio_quality: audioQuality,
      asr_diagnostics: {
        source: asr.source,
        recognitionStatus: asr.recognitionStatus,
        transcriptScript: asr.transcriptScript,
        usable: asr.usable,
        snr: asr.snr,
        diagnostics: asr.diagnostics,
      },
    })
    .select("id,created_at")
    .single();

  if (insertError || !run) {
    await supabase.storage.from(RECORDINGS_BUCKET).remove([storagePath]);
    return NextResponse.json({ detail: "تعذر حفظ نتيجة التجربة." }, { status: 500 });
  }

  return NextResponse.json({ runId: run.id, createdAt: run.created_at, ...payload }, { status: 201 });
}
