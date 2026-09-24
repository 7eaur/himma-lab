export type AudioQualityState = "ready" | "warning" | "too_short" | "silence" | "invalid";

export type AudioQualityEvidence = {
  valid: boolean;
  sampleRate: number | null;
  channels: number | null;
  bitsPerSample: number | null;
  durationMs: number | null;
  rms: number | null;
  peak: number | null;
  silenceRatio: number | null;
  activeRatio: number | null;
  state: AudioQualityState;
  warnings: string[];
};

const MIN_DURATION_MS = 550;
const SILENCE_RMS = 0.0025;
const SILENCE_PEAK = 0.01;
const LOW_SIGNAL_RMS = 0.01;
const FRAME_MS = 20;
const FRAME_SILENCE_RMS = 0.006;

function invalid(warning: string): AudioQualityEvidence {
  return {
    valid: false,
    sampleRate: null,
    channels: null,
    bitsPerSample: null,
    durationMs: null,
    rms: null,
    peak: null,
    silenceRatio: null,
    activeRatio: null,
    state: "invalid",
    warnings: [warning],
  };
}

function fourCC(view: DataView, offset: number) {
  if (offset + 4 > view.byteLength) return "";
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

export function analyzePcm16Wav(input: ArrayBuffer | Uint8Array): AudioQualityEvidence {
  const view = input instanceof Uint8Array
    ? new DataView(input.buffer, input.byteOffset, input.byteLength)
    : new DataView(input);

  if (view.byteLength < 44 || fourCC(view, 0) !== "RIFF" || fourCC(view, 8) !== "WAVE") {
    return invalid("wav_invalid_header");
  }

  let cursor = 12;
  let audioFormat: number | null = null;
  let channels: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let dataOffset: number | null = null;
  let dataSize: number | null = null;

  while (cursor + 8 <= view.byteLength) {
    const id = fourCC(view, cursor);
    const size = view.getUint32(cursor + 4, true);
    const chunkStart = cursor + 8;
    const chunkEnd = Math.min(view.byteLength, chunkStart + size);

    if (id === "fmt " && chunkEnd - chunkStart >= 16) {
      audioFormat = view.getUint16(chunkStart, true);
      channels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (id === "data") {
      dataOffset = chunkStart;
      dataSize = chunkEnd - chunkStart;
      break;
    }

    cursor = chunkStart + size + (size % 2);
  }

  if (
    audioFormat !== 1
    || channels !== 1
    || sampleRate == null
    || bitsPerSample !== 16
    || dataOffset == null
    || dataSize == null
    || dataSize < 2
  ) {
    return invalid("wav_requires_pcm16_mono");
  }

  const sampleCount = Math.floor(dataSize / 2);
  if (sampleCount <= 0) return invalid("wav_has_no_samples");

  let sumSquares = 0;
  let peak = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = view.getInt16(dataOffset + index * 2, true) / 32768;
    const absolute = Math.abs(sample);
    sumSquares += sample * sample;
    if (absolute > peak) peak = absolute;
  }

  const rms = Math.sqrt(sumSquares / sampleCount);
  const durationMs = sampleCount / sampleRate * 1000;
  const frameSamples = Math.max(1, Math.round(sampleRate * FRAME_MS / 1000));
  let silentFrames = 0;
  let totalFrames = 0;

  for (let start = 0; start < sampleCount; start += frameSamples) {
    const end = Math.min(sampleCount, start + frameSamples);
    let frameSumSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = view.getInt16(dataOffset + index * 2, true) / 32768;
      frameSumSquares += sample * sample;
    }
    const frameRms = Math.sqrt(frameSumSquares / Math.max(1, end - start));
    if (frameRms < FRAME_SILENCE_RMS) silentFrames += 1;
    totalFrames += 1;
  }

  const silenceRatio = totalFrames ? silentFrames / totalFrames : 1;
  const activeRatio = 1 - silenceRatio;
  const warnings: string[] = [];

  if (durationMs < MIN_DURATION_MS) {
    return {
      valid: true,
      sampleRate,
      channels,
      bitsPerSample,
      durationMs,
      rms,
      peak,
      silenceRatio,
      activeRatio,
      state: "too_short",
      warnings: ["audio_too_short"],
    };
  }

  if (rms < SILENCE_RMS || peak < SILENCE_PEAK) {
    return {
      valid: true,
      sampleRate,
      channels,
      bitsPerSample,
      durationMs,
      rms,
      peak,
      silenceRatio,
      activeRatio,
      state: "silence",
      warnings: ["audio_signal_not_detected"],
    };
  }

  if (rms < LOW_SIGNAL_RMS) warnings.push("audio_signal_low");
  if (silenceRatio > 0.9) warnings.push("audio_mostly_silence");
  if (peak > 0.995) warnings.push("audio_may_be_clipped");

  return {
    valid: true,
    sampleRate,
    channels,
    bitsPerSample,
    durationMs,
    rms,
    peak,
    silenceRatio,
    activeRatio,
    state: warnings.length ? "warning" : "ready",
    warnings,
  };
}

export function blocksAnalysis(quality: AudioQualityEvidence) {
  return quality.state === "invalid" || quality.state === "too_short" || quality.state === "silence";
}
