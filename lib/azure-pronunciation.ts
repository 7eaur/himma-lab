type PronunciationWord = {
  word: string;
  accuracyScore: number | null;
  errorType: string | null;
  offsetSeconds: number | null;
  durationSeconds: number | null;
  phonemeScores: number[];
};

export type AzurePronunciationEvidence = {
  configured: boolean;
  provider: "azure-pronunciation-assessment";
  locale: string;
  transcript: string | null;
  recognitionStatus: string | null;
  confidence: number | null;
  accuracyScore: number | null;
  fluencyScore: number | null;
  completenessScore: number | null;
  pronunciationScore: number | null;
  words: PronunciationWord[];
  requestId: string | null;
  error: string | null;
};

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pronunciationUrl() {
  const explicit = process.env.HIMMA_AZURE_PRONUNCIATION_ENDPOINT?.trim().replace(/\/$/, "");
  const locale = process.env.HIMMA_AZURE_PRONUNCIATION_LOCALE?.trim() || "ar-SA";
  if (explicit) {
    if (explicit.includes("/speech/recognition/")) return `${explicit}?language=${encodeURIComponent(locale)}&format=detailed`;
    return `${explicit}/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`;
  }

  const region = process.env.HIMMA_AZURE_SPEECH_REGION?.trim()
    || (() => {
      const lexicalEndpoint = process.env.HIMMA_AZURE_SPEECH_ENDPOINT?.trim();
      if (!lexicalEndpoint) return "";
      try {
        const host = new URL(lexicalEndpoint).hostname;
        if (host.endsWith(".api.cognitive.microsoft.com")) return host.split(".")[0];
      } catch {}
      return "";
    })();

  if (!region) return null;
  return `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`;
}

export async function assessAzurePronunciation(audio: Blob, referenceText: string): Promise<AzurePronunciationEvidence> {
  const apiKey = process.env.HIMMA_AZURE_SPEECH_API_KEY?.trim();
  const locale = process.env.HIMMA_AZURE_PRONUNCIATION_LOCALE?.trim() || "ar-SA";
  const url = pronunciationUrl();
  if (!apiKey || !url) {
    return {
      configured: false, provider: "azure-pronunciation-assessment", locale,
      transcript: null, recognitionStatus: null, confidence: null, accuracyScore: null,
      fluencyScore: null, completenessScore: null, pronunciationScore: null, words: [],
      requestId: null, error: "pronunciation_provider_not_configured",
    };
  }

  const config = {
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: true,
  };
  const header = Buffer.from(JSON.stringify(config), "utf8").toString("base64");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Accept": "application/json",
        "Pronunciation-Assessment": header,
      },
      body: Buffer.from(await audio.arrayBuffer()),
      cache: "no-store",
    });

    const requestId = response.headers.get("apim-request-id") || response.headers.get("x-ms-request-id");
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !payload) {
      return {
        configured: true, provider: "azure-pronunciation-assessment", locale,
        transcript: null, recognitionStatus: null, confidence: null, accuracyScore: null,
        fluencyScore: null, completenessScore: null, pronunciationScore: null, words: [],
        requestId, error: `azure_pronunciation_${response.status}`,
      };
    }

    const recognitionStatus = String(payload.RecognitionStatus || "");
    const nbest = Array.isArray(payload.NBest) ? payload.NBest : [];
    const best = (nbest[0] && typeof nbest[0] === "object" ? nbest[0] : {}) as Record<string, unknown>;
    const rawWords = Array.isArray(best.Words) ? best.Words : [];

    const words = rawWords.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object").map((word) => {
      const rawPhonemes = Array.isArray(word.Phonemes) ? word.Phonemes : [];
      return {
        word: String(word.Word || ""),
        accuracyScore: numberOrNull(word.AccuracyScore),
        errorType: word.ErrorType == null ? null : String(word.ErrorType),
        offsetSeconds: typeof word.Offset === "number" ? word.Offset / 10_000_000 : null,
        durationSeconds: typeof word.Duration === "number" ? word.Duration / 10_000_000 : null,
        phonemeScores: rawPhonemes
          .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
          .map((phoneme) => numberOrNull(phoneme.AccuracyScore))
          .filter((score): score is number => score != null),
      };
    });

    return {
      configured: true,
      provider: "azure-pronunciation-assessment",
      locale,
      transcript: String(best.Display || payload.DisplayText || "") || null,
      recognitionStatus,
      confidence: numberOrNull(best.Confidence),
      accuracyScore: numberOrNull(best.AccuracyScore),
      fluencyScore: numberOrNull(best.FluencyScore),
      completenessScore: numberOrNull(best.CompletenessScore),
      pronunciationScore: numberOrNull(best.PronScore),
      words,
      requestId,
      error: recognitionStatus === "Success" ? null : recognitionStatus || "azure_pronunciation_unknown",
    };
  } catch {
    return {
      configured: true, provider: "azure-pronunciation-assessment", locale,
      transcript: null, recognitionStatus: null, confidence: null, accuracyScore: null,
      fluencyScore: null, completenessScore: null, pronunciationScore: null, words: [],
      requestId: null, error: "azure_pronunciation_network_error",
    };
  }
}
