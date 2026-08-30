export type ClientAudioQuality = {
  decodedDurationMs: number | null;
  rms: number | null;
  peak: number | null;
  silenceRatio: number | null;
};

export async function analyzeClientAudio(blob: Blob): Promise<ClientAudioQuality> {
  if (typeof window === "undefined") return { decodedDurationMs: null, rms: null, peak: null, silenceRatio: null };
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return { decodedDurationMs: null, rms: null, peak: null, silenceRatio: null };
  const context = new AudioContextCtor();
  try {
    const buffer = await context.decodeAudioData((await blob.arrayBuffer()).slice(0));
    let sumSquares = 0;
    let peak = 0;
    let silent = 0;
    let count = 0;
    const silenceThreshold = 0.01;

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) {
        const absolute = Math.abs(data[i]);
        sumSquares += data[i] * data[i];
        if (absolute > peak) peak = absolute;
        if (absolute < silenceThreshold) silent += 1;
        count += 1;
      }
    }

    return {
      decodedDurationMs: Math.round(buffer.duration * 1000),
      rms: count ? Math.sqrt(sumSquares / count) : null,
      peak: count ? peak : null,
      silenceRatio: count ? silent / count : null,
    };
  } catch {
    return { decodedDurationMs: null, rms: null, peak: null, silenceRatio: null };
  } finally {
    await context.close().catch(() => undefined);
  }
}
