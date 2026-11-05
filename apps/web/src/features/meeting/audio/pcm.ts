/**
 * Pure audio utilities for speech capture. No DOM APIs: everything here is unit-testable and is
 * exactly what runs in the browser.
 */

export const STT_SAMPLE_RATE = 16_000;

export function rms(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (const sample of frame) sum += sample * sample;
  return Math.sqrt(sum / frame.length);
}

/** Linear-interpolation resampler (adequate for speech band-limited to 8 kHz). */
export function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const frac = position - index;
    const a = input[index] ?? 0;
    const b = input[Math.min(index + 1, input.length - 1)] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Encodes mono float samples as a 16-bit PCM WAV file. */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return buffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export interface SegmenterOptions {
  readonly sampleRate: number;
  readonly rmsThreshold?: number;
  readonly minSpeechMs?: number;
  readonly hangoverMs?: number;
  readonly maxSegmentMs?: number;
  readonly preRollMs?: number;
}

/**
 * Energy-based speech segmenter. It emits one segment per utterance (speech plus a short
 * pre-roll and hangover) and drops silence and clicks entirely, so silence is never uploaded
 * and never billed. Long monologues are cut at `maxSegmentMs` to bound latency.
 */
export class SpeechSegmenter {
  private readonly threshold: number;
  private readonly minSpeechMs: number;
  private readonly hangoverMs: number;
  private readonly maxSegmentMs: number;
  private readonly preRollMs: number;
  private preRoll: Float32Array[] = [];
  private preRollDurationMs = 0;
  private segment: Float32Array[] = [];
  private segmentMs = 0;
  private speechMs = 0;
  private silenceMs = 0;
  private speaking = false;

  constructor(private readonly options: SegmenterOptions) {
    this.threshold = options.rmsThreshold ?? 0.015;
    this.minSpeechMs = options.minSpeechMs ?? 350;
    this.hangoverMs = options.hangoverMs ?? 700;
    this.maxSegmentMs = options.maxSegmentMs ?? 12_000;
    this.preRollMs = options.preRollMs ?? 200;
  }

  push(frame: Float32Array): Float32Array[] {
    const frameMs = (frame.length / this.options.sampleRate) * 1000;
    const loud = rms(frame) >= this.threshold;
    const out: Float32Array[] = [];

    if (!this.speaking) {
      if (!loud) {
        this.preRoll.push(frame);
        this.preRollDurationMs += frameMs;
        while (this.preRollDurationMs > this.preRollMs && this.preRoll.length > 1) {
          const dropped = this.preRoll.shift();
          this.preRollDurationMs -= ((dropped?.length ?? 0) / this.options.sampleRate) * 1000;
        }
        return out;
      }
      this.speaking = true;
      this.segment = [...this.preRoll];
      this.segmentMs = this.preRollDurationMs;
      this.preRoll = [];
      this.preRollDurationMs = 0;
      this.speechMs = 0;
      this.silenceMs = 0;
    }

    this.segment.push(frame);
    this.segmentMs += frameMs;
    if (loud) {
      this.speechMs += frameMs;
      this.silenceMs = 0;
    } else {
      this.silenceMs += frameMs;
    }

    if (this.silenceMs >= this.hangoverMs || this.segmentMs >= this.maxSegmentMs) {
      const finished = this.finish();
      if (finished) out.push(finished);
    }
    return out;
  }

  /** Emits any utterance still in progress (call when capture stops). */
  flush(): Float32Array | null {
    return this.speaking ? this.finish() : null;
  }

  private finish(): Float32Array | null {
    const keep = this.speechMs >= this.minSpeechMs;
    const frames = this.segment;
    this.segment = [];
    this.segmentMs = 0;
    this.speechMs = 0;
    this.silenceMs = 0;
    this.speaking = false;
    if (!keep) return null;
    const total = frames.reduce((n, f) => n + f.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const frame of frames) {
      merged.set(frame, offset);
      offset += frame.length;
    }
    return merged;
  }
}
