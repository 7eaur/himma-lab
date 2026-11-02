import { NextResponse } from "next/server";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase";
import { transcribeAzure } from "@/lib/azure";
import { assessAzurePronunciation } from "@/lib/azure-pronunciation";
import { analyzePcm16Wav, blocksAnalysis } from "@/lib/audio-quality";
import { SPEECH_CONTENT_VERSION, TEST_CASES, decisionPreview } from "@/lib/speech-experiment";
import rawLetterAliasCatalog from "@/data/himma-v2-targeted-letter-asr-aliases.json";

export const runtime = "nodejs";

const EXPERIMENT_DECISION_VERSION = "lab-v2-20261102";
const LETTER_ALIAS_CATALOG_VERSION = rawLetterAliasCatalog.schemaVersion;


function finiteNumber(value: FormDataEntryValue | null) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function audioQualityMessage() {
  return "ملف التسجيل غير صالح تقنيًا للتحليل. أعد التسجيل.";
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
    return NextResponse.json({ detail: "لم يصل ملف صوتي قابل للقراءة." }, { status: 422 });
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
        detail: audioQualityMessage(),
        code: `audio_quality_${audioQuality.state}`,
        audioQuality,
      },
      { status: 422 },
    );
  }

  const storagePath = `speech-experiments/${participant.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.wav`;
  const { error: uploadError } = await supabase.storage.from(RECORDINGS_BUCKET).upload(storagePath, bytes, {
    contentType: "audio/wav",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ detail: "تعذر رفع التسجيل." }, { status: 500 });

  const asr = await transcribeAzure(audio, testCase.text, {
    allowNonArabicTranscript: testCase.mode === "targeted_pronunciation",
  });
  const analysisTranscript = asr.usable ? asr.transcript : null;
  const preview = decisionPreview(testCase, analysisTranscript);
  const pronunciation = testCase.pronunciationAssessment
    ? await assessAzurePronunciation(audio, testCase.readingReference)
    : null;

  const finalPreview = (() => {
    if (!asr.usable) {
      return {
        ...preview,
        state: "retry_required" as const,
        reason: asr.error || "asr_unusable",
      };
    }

    if (!testCase.pronunciationAssessment) return preview;
    if (!pronunciation?.configured || pronunciation.error || pronunciation.pronunciationScore == null) {
      return {
        ...preview,
        state: "retry_required" as const,
        reason: "pronunciation_evidence_unavailable",
      };
    }

    return {
      ...preview,
      state: "retry_required" as const,
      reason: preview.alias.matched
        ? "asr_spelling_variant_requires_human_vowel_verification"
        : "pronunciation_evidence_pending_calibration",
    };
  })();

  const payload = {
    participantCode,
    contentVersion: SPEECH_CONTENT_VERSION,
    testKey: testCase.key,
    sourceQuestionId: testCase.sourceQuestionId,
    group: testCase.group,
    groupLabel: testCase.groupLabel,
    role: testCase.role,
    prompt: testCase.prompt,
    label: testCase.label,
    speechMode: testCase.mode,
    pronunciationFocus: testCase.focus,
    pronunciationAssessmentRequired: testCase.pronunciationAssessment,
    referenceText: testCase.text,
    reviewReference: testCase.readingReference,
    displayScoringPolicy: testCase.displayScoringPolicy,
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
    alias: {
      ...preview.alias,
      catalogVersion: LETTER_ALIAS_CATALOG_VERSION,
    },
    pronunciation,
    decision: {
      state: finalPreview.state,
      reason: finalPreview.reason,
      academicEffect: "none",
      academicAuthority: "human_supervisor",
      policyVersion: EXPERIMENT_DECISION_VERSION,
    },
  };

  const { data: run, error: insertError } = await supabase
    .from("speech_experiment_runs")
    .insert({
      participant_code: participantCode,
      test_key: testCase.key,
      source_question_id: testCase.sourceQuestionId,
      content_version: SPEECH_CONTENT_VERSION,
      question_group: testCase.group,
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
      reading_analysis: {
        ...preview.reading,
        reviewReference: testCase.readingReference,
        displayScoringPolicy: testCase.displayScoringPolicy,
      },
      alias_evidence: {
        ...preview.alias,
        catalogVersion: LETTER_ALIAS_CATALOG_VERSION,
      },
      pronunciation_evidence: pronunciation,
      decision_state: finalPreview.state,
      decision_reason: finalPreview.reason,
      audio_quality: audioQuality,
      asr_diagnostics: {
        source: asr.source,
        decisionPolicyVersion: EXPERIMENT_DECISION_VERSION,
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
