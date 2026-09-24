type AzureWord = {
  text: string;
  offsetMilliseconds?: number;
  durationMilliseconds?: number;
};

type AzurePhrase = {
  text?: string;
  confidence?: number;
  locale?: string;
  words?: AzureWord[];
};

type TranscriptScript = "arabic" | "non_arabic" | "empty";
type AzureSource = "short-audio" | "fast-transcription" | "none";

export type AzureEvidence = {
  configured: boolean;
  provider: "azure-speech";
  locale: "ar-OM";
  transcript: string | null;
  confidence: number | null;
  durationSeconds: number | null;
  words: Array<{ text: string; startSeconds: number | null; endSeconds: number | null }>;
  requestId: string | null;
  error: string | null;
  recognitionStatus: string | null;
  source: AzureSource;
  transcriptScript: TranscriptScript;
  usable: boolean;
  snr: number | null;
  diagnostics: {
    primarySource: AzureSource;
    primaryStatus: string | null;
    primaryError: string | null;
    fallbackSource: AzureSource | null;
    fallbackStatus: string | null;
    fallbackError: string | null;
    phraseLocales: string[];
  };
};

type RawAzureEvidence = Omit<AzureEvidence, "usable" | "diagnostics"> & {
  phraseLocales: string[];
};

type TranscribeOptions = {
  allowNonArabicTranscript?: boolean;
};

function filenameForMime(mime: string) {
  const normalized = mime.toLowerCase();
  if (normalized.includes("webm")) return "recording.webm";
  if (normalized.includes("ogg") || normalized.includes("opus")) return "recording.ogg";
  if (normalized.includes("wav")) return "recording.wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "recording.mp3";
  return "recording.bin";
}

function transcriptScript(value: string | null): TranscriptScript {
  if (!value?.trim()) return "empty";
  const letters = [...value].filter((char) => /\p{L}/u.test(char));
  if (!letters.length) return "empty";
  const arabic = letters.filter((char) => /\p{Script=Arabic}/u.test(char)).length;
  return arabic / letters.length >= 0.55 ? "arabic" : "non_arabic";
}

function referenceUsesArabic(value: string) {
  return /\p{Script=Arabic}/u.test(value);
}

function regionFromEndpoint(endpoint: string | undefined) {
  const explicit = process.env.HIMMA_AZURE_SPEECH_REGION?.trim();
  if (explicit) return explicit;

  if (!endpoint) return "";
  try {
    const host = new URL(endpoint).hostname;
    if (host.endsWith(".api.cognitive.microsoft.com")) return host.split(".")[0] || "";
    if (host.endsWith(".stt.speech.microsoft.com")) return host.split(".")[0] || "";
  } catch {}
  return "";
}

function shortAudioUrl(endpoint: string | undefined) {
  const region = regionFromEndpoint(endpoint);
  if (region) {
    return `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ar-OM&format=detailed`;
  }

  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    if (url.hostname.endsWith(".cognitiveservices.azure.com")) {
      return `${endpoint.replace(/\/$/, "")}/stt/speech/recognition/conversation/cognitiveservices/v1?language=ar-OM&format=detailed`;
    }
  } catch {}
  return null;
}

function emptyRaw(configured: boolean, source: AzureSource, error: string | null): RawAzureEvidence {
  return {
    configured,
    provider: "azure-speech",
    locale: "ar-OM",
    transcript: null,
    confidence: null,
    durationSeconds: null,
    words: [],
    requestId: null,
    error,
    recognitionStatus: null,
    source,
    transcriptScript: "empty",
    snr: null,
    phraseLocales: [],
  };
}

function mapRecognitionError(status: string | null) {
  const normalized = (status || "").toLowerCase();
  if (!normalized) return "azure_no_transcript";
  if (normalized === "nomatch") return "azure_no_match";
  if (normalized === "initialsilencetimeout") return "azure_initial_silence_timeout";
  if (normalized === "babbletimeout") return "azure_babble_timeout";
  if (normalized === "error") return "azure_recognition_error";
  return `azure_recognition_${normalized}`;
}

async function transcribeShortAudio(
  audio: Blob,
  endpoint: string | undefined,
  apiKey: string,
): Promise<RawAzureEvidence> {
  const url = shortAudioUrl(endpoint);
  if (!url) return emptyRaw(true, "short-audio", "azure_short_endpoint_unavailable");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Accept": "application/json",
      },
      body: Buffer.from(await audio.arrayBuffer()),
      cache: "no-store",
    });

    const requestId = response.headers.get("apim-request-id") || response.headers.get("x-ms-request-id");
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

    if (!response.ok || !payload) {
      return {
        ...emptyRaw(true, "short-audio", `azure_short_${response.status}`),
        requestId,
      };
    }

    const recognitionStatus = String(payload.RecognitionStatus || "") || null;
    const rawNBest = Array.isArray(payload.NBest) ? payload.NBest : [];
    const best = rawNBest[0] && typeof rawNBest[0] === "object"
      ? rawNBest[0] as Record<string, unknown>
      : {};
    const transcript = String(best.Display || payload.DisplayText || best.Lexical || "").trim() || null;
    const confidence = typeof best.Confidence === "number" ? best.Confidence : null;
    const duration100ns = typeof payload.Duration === "number" ? payload.Duration : null;
    const snr = typeof payload.SNR === "number" ? payload.SNR : null;
    const success = recognitionStatus === "Success" && Boolean(transcript);

    return {
      configured: true,
      provider: "azure-speech",
      locale: "ar-OM",
      transcript,
      confidence,
      durationSeconds: duration100ns == null ? null : duration100ns / 10_000_000,
      words: [],
      requestId,
      error: success ? null : mapRecognitionError(recognitionStatus),
      recognitionStatus,
      source: "short-audio",
      transcriptScript: transcriptScript(transcript),
      snr,
      phraseLocales: [],
    };
  } catch {
    return emptyRaw(true, "short-audio", "azure_short_network_error");
  }
}

async function transcribeFast(
  audio: Blob,
  referenceText: string,
  endpoint: string,
  apiKey: string,
): Promise<RawAzureEvidence> {
  const useReferenceHint = ["1", "true", "yes", "on"].includes(
    (process.env.HIMMA_AZURE_SPEECH_REFERENCE_HINT || "false").toLowerCase(),
  );
  const definition: Record<string, unknown> = { locales: ["ar-OM"] };
  if (useReferenceHint && referenceText.trim()) {
    definition.phraseList = { phrases: [referenceText.trim()] };
  }

  const form = new FormData();
  form.append("audio", audio, filenameForMime(audio.type || "application/octet-stream"));
  form.append("definition", new Blob([JSON.stringify(definition)], { type: "application/json" }));

  const controller = new AbortController();
  const timeoutSeconds = Number(process.env.HIMMA_AZURE_SPEECH_TIMEOUT_SECONDS || 45);
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutSeconds) * 1000);

  try {
    const response = await fetch(
      `${endpoint}/speechtotext/transcriptions:transcribe?api-version=2025-10-15`,
      {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": apiKey },
        body: form,
        signal: controller.signal,
        cache: "no-store",
      },
    );

    const requestId = response.headers.get("apim-request-id") || response.headers.get("x-ms-request-id");
    if (!response.ok) {
      return {
        ...emptyRaw(true, "fast-transcription", `azure_fast_${response.status}`),
        requestId,
      };
    }

    const payload = await response.json() as {
      combinedPhrases?: AzurePhrase[];
      phrases?: AzurePhrase[];
      durationMilliseconds?: number;
    };
    const phrases = Array.isArray(payload.phrases) ? payload.phrases : [];
    const combined = Array.isArray(payload.combinedPhrases) ? payload.combinedPhrases : [];
    const transcript =
      combined.map((part) => part.text?.trim()).filter(Boolean).join(" ")
      || phrases.map((part) => part.text?.trim()).filter(Boolean).join(" ")
      || null;
    const confidenceValues = phrases
      .map((part) => part.confidence)
      .filter((value): value is number => typeof value === "number");
    const confidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null;
    const words = phrases.flatMap((phrase) => phrase.words || []).map((word) => {
      const start = typeof word.offsetMilliseconds === "number" ? word.offsetMilliseconds / 1000 : null;
      const duration = typeof word.durationMilliseconds === "number" ? word.durationMilliseconds / 1000 : null;
      return {
        text: word.text || "",
        startSeconds: start,
        endSeconds: start != null && duration != null ? start + duration : null,
      };
    });
    const phraseLocales = [
      ...new Set(phrases.map((phrase) => phrase.locale).filter((value): value is string => Boolean(value))),
    ];

    return {
      configured: true,
      provider: "azure-speech",
      locale: "ar-OM",
      transcript,
      confidence,
      durationSeconds:
        typeof payload.durationMilliseconds === "number"
          ? payload.durationMilliseconds / 1000
          : null,
      words,
      requestId,
      error: transcript ? null : "azure_no_transcript",
      recognitionStatus: transcript ? "Success" : "NoMatch",
      source: "fast-transcription",
      transcriptScript: transcriptScript(transcript),
      snr: null,
      phraseLocales,
    };
  } catch (error) {
    const label =
      error instanceof Error && error.name === "AbortError"
        ? "azure_fast_timeout"
        : "azure_fast_network_error";
    return emptyRaw(true, "fast-transcription", label);
  } finally {
    clearTimeout(timeout);
  }
}

function accepted(
  evidence: RawAzureEvidence,
  referenceText: string,
  allowNonArabicTranscript: boolean,
) {
  if (!evidence.transcript?.trim()) return false;
  if (allowNonArabicTranscript) return true;
  if (!referenceUsesArabic(referenceText)) return true;
  return evidence.transcriptScript === "arabic";
}

function finalize(
  selected: RawAzureEvidence,
  primary: RawAzureEvidence,
  fallback: RawAzureEvidence | null,
  referenceText: string,
  allowNonArabicTranscript: boolean,
): AzureEvidence {
  const isAccepted = accepted(selected, referenceText, allowNonArabicTranscript);
  const scriptFailure =
    Boolean(selected.transcript)
    && referenceUsesArabic(referenceText)
    && !allowNonArabicTranscript
    && selected.transcriptScript !== "arabic";

  return {
    configured: selected.configured,
    provider: selected.provider,
    locale: selected.locale,
    transcript: selected.transcript,
    confidence: selected.confidence,
    durationSeconds: selected.durationSeconds,
    words: selected.words,
    requestId: selected.requestId,
    error: scriptFailure
      ? "azure_non_arabic_transcript"
      : (isAccepted ? null : selected.error || "azure_no_transcript"),
    recognitionStatus: selected.recognitionStatus,
    source: selected.source,
    transcriptScript: selected.transcriptScript,
    usable: isAccepted,
    snr: selected.snr,
    diagnostics: {
      primarySource: primary.source,
      primaryStatus: primary.recognitionStatus,
      primaryError: primary.error,
      fallbackSource: fallback?.source || null,
      fallbackStatus: fallback?.recognitionStatus || null,
      fallbackError: fallback?.error || null,
      phraseLocales: [
        ...new Set([...(primary.phraseLocales || []), ...(fallback?.phraseLocales || [])]),
      ],
    },
  };
}

export async function transcribeAzure(
  audio: Blob,
  referenceText: string,
  options: TranscribeOptions = {},
): Promise<AzureEvidence> {
  const endpoint = process.env.HIMMA_AZURE_SPEECH_ENDPOINT?.trim().replace(/\/$/, "");
  const apiKey = process.env.HIMMA_AZURE_SPEECH_API_KEY?.trim();
  const allowNonArabicTranscript = Boolean(options.allowNonArabicTranscript);

  if (!endpoint || !apiKey) {
    const empty = emptyRaw(false, "none", "azure_not_configured");
    return finalize(empty, empty, null, referenceText, allowNonArabicTranscript);
  }

  const primary = await transcribeShortAudio(audio, endpoint, apiKey);
  if (accepted(primary, referenceText, allowNonArabicTranscript)) {
    return finalize(primary, primary, null, referenceText, allowNonArabicTranscript);
  }

  const fallback = await transcribeFast(audio, referenceText, endpoint, apiKey);
  if (accepted(fallback, referenceText, allowNonArabicTranscript)) {
    return finalize(fallback, primary, fallback, referenceText, allowNonArabicTranscript);
  }

  const selected = primary.transcript?.trim()
    ? primary
    : fallback.transcript?.trim()
      ? fallback
      : primary.error && primary.error !== "azure_short_endpoint_unavailable"
        ? primary
        : fallback;

  return finalize(selected, primary, fallback, referenceText, allowNonArabicTranscript);
}
