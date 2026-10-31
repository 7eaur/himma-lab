import assert from "node:assert/strict";
import { analyzePcm16Wav, blocksAnalysis } from "../lib/audio-quality.ts";

// These samples test PCM preflight behavior, not speech-recognition accuracy.
// A delayed or quiet child voice is sent to Azure for independent evidence.
function wav(durationMs, voiceStartMs = -1, voiceDurationMs = 0, amplitude = 0) {
  const sampleRate = 16000;
  const count = Math.round(sampleRate * durationMs / 1000);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  for (const [offset, value] of [[0, "RIFF"], [8, "WAVE"], [12, "fmt "], [36, "data"]]) {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  }
  view.setUint32(4, buffer.byteLength - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i += 1) {
    const t = i * 1000 / sampleRate;
    const active = t >= voiceStartMs && t < voiceStartMs + voiceDurationMs;
    const sample = active ? amplitude * Math.sin(2 * Math.PI * 330 * i / sampleRate) : 0;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }
  return new Uint8Array(buffer);
}

function allowed(label, data) {
  const evidence = analyzePcm16Wav(data);
  assert.equal(evidence.valid, true, label);
  assert.equal(blocksAnalysis(evidence), false, label);
  return evidence;
}

const quietVoice = allowed("quiet real voice should not be blocked", wav(2600, 1550, 190, 0.008));
assert.equal(quietVoice.state, "warning");
assert.ok(quietVoice.rms < 0.0025); // Previously rejected before Azure.

const delayedLetter = allowed("letter after long wait should not be blocked", wav(4200, 3400, 190, 0.02));
assert.ok(delayedLetter.silenceRatio > 0.9);
assert.ok(delayedLetter.warnings.includes("audio_mostly_low_energy"));

const shortLetter = allowed("250ms vowel should not be blocked", wav(250, 40, 180, 0.03));
assert.ok(shortLetter.warnings.includes("audio_brief_sample"));

const nearZero = allowed("very quiet but nonzero PCM should not become silence", wav(2000, 900, 220, 0.001));
assert.notEqual(nearZero.state, "silence");

const digitalSilence = allowed("all-zero recording can still be investigated", wav(2000));
assert.equal(digitalSilence.state, "silence");
assert.ok(digitalSilence.warnings.includes("audio_digital_silence"));

const malformed = analyzePcm16Wav(new Uint8Array([1, 2, 3]));
assert.equal(malformed.state, "invalid");
assert.equal(blocksAnalysis(malformed), true);

const empty = analyzePcm16Wav(wav(0));
assert.equal(empty.state, "invalid");
assert.equal(blocksAnalysis(empty), true);

console.log("Audio preflight regression tests passed: quiet/delayed/brief/near-zero/silence/invalid.");
