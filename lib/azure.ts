type AzureWord = {
  text: string;
  offsetMilliseconds?: number;
  durationMilliseconds?: number;
};

type AzurePhrase = {
  text?: string;
  confidence?: number;
  words?: AzureWord[];
};

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
};

function filenameForMime(mime: string) {
  const normalized = mime.toLowerCase();
  if (normalized.includes("webm")) return "recording.webm";
  if (normalized.includes("ogg") || normalized.includes("opus")) return "recording.ogg";
  if (normalized.includes("wav")) return "recording.wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "recording.mp3";
  return "recording.bin";
}

export async function transcribeAzure(audio: Blob, referenceText: string): Promise<AzureEvidence> {
  const endpoint = process.env.HIMMA_AZURE_SPEECH_ENDPOINT?.trim().replace(/\/$/, "");
  const apiKey = process.env.HIMMA_AZURE_SPEECH_API_KEY?.trim();
  if (!endpoint || !apiKey) {
    return { configured: false, provider: "azure-speech", locale: "ar-OM", transcript: null, confidence: null, durationSeconds: null, words: [], requestId: null, error: null };
  }

  const useReferenceHint = ["1", "true", "yes", "on"].includes((process.env.HIMMA_AZURE_SPEECH_REFERENCE_HINT || "false").toLowerCase());
  const definition: Record<string, unknown> = { locales: ["ar-OM"] };
  if (useReferenceHint && referenceText.trim()) definition.phraseList = { phrases: [referenceText.trim()] };

  const form = new FormData();
  form.append("audio", audio, filenameForMime(audio.type || "application/octet-stream"));
  form.append("definition", new Blob([JSON.stringify(definition)], { type: "application/json" }));

  const controller = new AbortController();
  const timeoutSeconds = Number(process.env.HIMMA_AZURE_SPEECH_TIMEOUT_SECONDS || 45);
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutSeconds) * 1000);

  try {
    const response = await fetch(`${endpoint}/speechtotext/transcriptions:transcribe?api-version=2025-10-15`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      body: form,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { configured: true, provider: "azure-speech", locale: "ar-OM", transcript: null, confidence: null, durationSeconds: null, words: [], requestId: response.headers.get("apim-request-id"), error: `azure_${response.status}` };
    }

    const payload = await response.json() as { combinedPhrases?: AzurePhrase[]; phrases?: AzurePhrase[]; durationMilliseconds?: number };
    const phrases = Array.isArray(payload.phrases) ? payload.phrases : [];
    const combined = Array.isArray(payload.combinedPhrases) ? payload.combinedPhrases : [];
    const transcript = combined.map((part) => part.text?.trim()).filter(Boolean).join(" ") || phrases.map((part) => part.text?.trim()).filter(Boolean).join(" ") || null;
    const confidenceValues = phrases.map((part) => part.confidence).filter((value): value is number => typeof value === "number");
    const confidence = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : null;
    const words = phrases.flatMap((phrase) => phrase.words || []).map((word) => {
      const start = typeof word.offsetMilliseconds === "number" ? word.offsetMilliseconds / 1000 : null;
      const duration = typeof word.durationMilliseconds === "number" ? word.durationMilliseconds / 1000 : null;
      return { text: word.text || "", startSeconds: start, endSeconds: start != null && duration != null ? start + duration : null };
    });

    return {
      configured: true,
      provider: "azure-speech",
      locale: "ar-OM",
      transcript,
      confidence,
      durationSeconds: typeof payload.durationMilliseconds === "number" ? payload.durationMilliseconds / 1000 : null,
      words,
      requestId: response.headers.get("apim-request-id") || response.headers.get("x-ms-request-id"),
      error: null,
    };
  } catch (error) {
    const label = error instanceof Error && error.name === "AbortError" ? "azure_timeout" : "azure_network_error";
    return { configured: true, provider: "azure-speech", locale: "ar-OM", transcript: null, confidence: null, durationSeconds: null, words: [], requestId: null, error: label };
  } finally {
    clearTimeout(timeout);
  }
}
