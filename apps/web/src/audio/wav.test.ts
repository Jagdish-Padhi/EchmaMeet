import { describe, expect, it } from 'vitest';
import { bytesToBase64, concatInt16, encodeWav, rms } from './wav';

describe('wav encoding for Gnani', () => {
  it('writes a canonical 16 kHz mono PCM header', () => {
    const wav = encodeWav(new Int16Array([0, 1000, -1000, 32767]), 16000);
    const view = new DataView(wav.buffer);
    const tag = (o: number) => String.fromCharCode(...wav.subarray(o, o + 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(28, true)).toBe(32000); // byte rate
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(46, true)).toBe(1000);
    expect(wav.length).toBe(44 + 8);
  });

  it('round-trips base64 for large clips without stack overflow', () => {
    const big = new Uint8Array(200_000).fill(7);
    expect(atob(bytesToBase64(big)).length).toBe(200_000);
  });

  it('concatenates frames and measures loudness', () => {
    expect([...concatInt16([new Int16Array([1, 2]), new Int16Array([3])])]).toEqual([1, 2, 3]);
    expect(rms(new Int16Array(100))).toBe(0);
    expect(rms(new Int16Array(100).fill(16384))).toBeCloseTo(0.5, 2);
  });
});
