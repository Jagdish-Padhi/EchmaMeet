import { describe, expect, it } from 'vitest';
import { SpeechSegmenter, encodeWavPcm16, resampleLinear, rms } from './pcm';

const RATE = 16_000;
const frame = (amp: number, ms = 20) => {
  const n = (RATE * ms) / 1000;
  return Float32Array.from({ length: n }, (_, i) => Math.sin(i / 3) * amp);
};

describe('WAV encoding', () => {
  it('writes a valid PCM16 mono header and clamps samples', () => {
    const buf = encodeWavPcm16(Float32Array.from([0, 1, -1, 2, -2]), RATE);
    const view = new DataView(buf);
    const ascii = (o: number, n: number) => String.fromCharCode(...new Uint8Array(buf, o, n));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10);
    expect(view.getInt16(44 + 2, true)).toBe(32767);
    expect(view.getInt16(44 + 4, true)).toBe(-32768);
    expect(view.getInt16(44 + 6, true)).toBe(32767); // 2.0 clamped
    expect(buf.byteLength).toBe(54);
  });
});

describe('resampling', () => {
  it('downsamples 48 kHz to 16 kHz preserving duration and a low-frequency tone', () => {
    const input = Float32Array.from({ length: 4800 }, (_, i) =>
      Math.sin((2 * Math.PI * 200 * i) / 48_000),
    );
    const out = resampleLinear(input, 48_000, 16_000);
    expect(out.length).toBe(1600);
    expect(rms(out)).toBeCloseTo(rms(input), 1);
  });
});

describe('SpeechSegmenter', () => {
  it('emits nothing for silence and for sub-minimum clicks', () => {
    const seg = new SpeechSegmenter({ sampleRate: RATE });
    const out: Float32Array[] = [];
    for (let i = 0; i < 100; i += 1) out.push(...seg.push(frame(0.001)));
    out.push(...seg.push(frame(0.5)), ...seg.push(frame(0.5))); // 40 ms click
    for (let i = 0; i < 60; i += 1) out.push(...seg.push(frame(0.001)));
    expect(out).toHaveLength(0);
  });

  it('emits one utterance with pre-roll and ends after the hangover', () => {
    const seg = new SpeechSegmenter({ sampleRate: RATE });
    const out: Float32Array[] = [];
    for (let i = 0; i < 20; i += 1) out.push(...seg.push(frame(0.001))); // 400 ms silence
    for (let i = 0; i < 40; i += 1) out.push(...seg.push(frame(0.3))); // 800 ms speech
    for (let i = 0; i < 40; i += 1) out.push(...seg.push(frame(0.001))); // 800 ms silence
    expect(out).toHaveLength(1);
    const seconds = (out[0]?.length ?? 0) / RATE;
    expect(seconds).toBeGreaterThan(1.5); // pre-roll + speech + hangover
    expect(seconds).toBeLessThan(2.0);
  });

  it('cuts a long monologue at the maximum segment length and flushes the tail', () => {
    const seg = new SpeechSegmenter({ sampleRate: RATE, maxSegmentMs: 2000 });
    const out: Float32Array[] = [];
    for (let i = 0; i < 175; i += 1) out.push(...seg.push(frame(0.3))); // 3.5 s of speech
    expect(out).toHaveLength(1);
    const tail = seg.flush();
    expect(tail).not.toBeNull();
    expect((tail?.length ?? 0) / RATE).toBeGreaterThan(1);
  });
});
