const TARGET_SAMPLE_RATE = 16_000;

function resampleMono(input: Float32Array, sourceRate: number, targetRate = TARGET_SAMPLE_RATE) {
  if (input.length === 0 || sourceRate === targetRate) return new Float32Array(input);
  const outputLength = Math.max(1, Math.round(input.length * targetRate / sourceRate));
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function encodePcm16Wav(samples: Float32Array, sampleRate = TARGET_SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); ascii(36, "data"); view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  samples.forEach((sample) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), true);
    offset += 2;
  });
  return buffer;
}

export class PcmWavRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = TARGET_SAMPLE_RATE;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.context = new AudioContext();
    await this.context.resume();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.sampleRate = this.context.sampleRate;
    this.chunks = [];
    this.processor.onaudioprocess = (event) => this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  async stop() {
    if (!this.stream || !this.context || !this.source || !this.processor) throw new Error("Recorder is not running");
    this.processor.onaudioprocess = null; this.source.disconnect(); this.processor.disconnect();
    this.stream.getTracks().forEach((track) => track.stop());
    await this.context.close();
    const length = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(length);
    let offset = 0; this.chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.length; });
    const wav = encodePcm16Wav(resampleMono(merged, this.sampleRate));
    this.cancel();
    return new Blob([wav], { type: "audio/wav" });
  }

  cancel() {
    try { this.processor?.disconnect(); this.source?.disconnect(); } catch {}
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") void this.context.close();
    this.stream = null; this.context = null; this.source = null; this.processor = null; this.chunks = [];
  }
}
