/**
 * Minimal RIFF/WAVE inspection. Muse Voice Transcribe accepts only PCM16 mono WAV at 16 kHz or
 * 24 kHz, so the server validates before spending a network round trip (and money) on a file
 * the provider would reject.
 */
export interface WavInfo {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly audioFormat: number;
  readonly dataBytes: number;
  readonly durationMs: number;
}

export function inspectWav(buffer: Buffer): WavInfo | null {
  if (buffer.length < 44) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }
  let offset = 12;
  let fmt: { audioFormat: number; channels: number; sampleRate: number; bits: number } | null =
    null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ' && body + 16 <= buffer.length) {
      fmt = {
        audioFormat: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bits: buffer.readUInt16LE(body + 14),
      };
    } else if (id === 'data' && fmt) {
      const dataBytes = Math.min(size, buffer.length - body);
      const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bits / 8);
      return {
        sampleRate: fmt.sampleRate,
        channels: fmt.channels,
        bitsPerSample: fmt.bits,
        audioFormat: fmt.audioFormat,
        dataBytes,
        durationMs: bytesPerSecond > 0 ? Math.round((dataBytes / bytesPerSecond) * 1000) : 0,
      };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

export function isMuseCompatibleWav(info: WavInfo | null): info is WavInfo {
  return (
    info !== null &&
    info.audioFormat === 1 &&
    info.channels === 1 &&
    info.bitsPerSample === 16 &&
    (info.sampleRate === 16_000 || info.sampleRate === 24_000)
  );
}

/** Root-mean-square energy of PCM16 samples, 0..1. Used to skip silent segments for free. */
export function pcm16Rms(buffer: Buffer, info: WavInfo): number {
  const start = buffer.indexOf('data') + 8;
  const end = Math.min(buffer.length, start + info.dataBytes);
  let sum = 0;
  let count = 0;
  for (let i = start; i + 1 < end; i += 2) {
    const sample = buffer.readInt16LE(i) / 32768;
    sum += sample * sample;
    count += 1;
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}
