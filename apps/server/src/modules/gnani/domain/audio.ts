/** Container sniffing for uploads. Gnani REST accepts wav, mp3, ogg, flac, aac and m4a. */
export type AudioContainer = 'wav' | 'mp3' | 'ogg' | 'flac' | 'aac' | 'm4a' | 'webm' | 'unknown';

export function sniffAudioContainer(buf: Uint8Array): AudioContainer {
  const ascii = (start: number, len: number): string =>
    String.fromCharCode(...buf.subarray(start, start + len));
  if (buf.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return 'wav';
  if (buf.length >= 4 && ascii(0, 4) === 'OggS') return 'ogg';
  if (buf.length >= 4 && ascii(0, 4) === 'fLaC') return 'flac';
  if (buf.length >= 3 && ascii(0, 3) === 'ID3') return 'mp3';
  if (buf.length >= 2 && buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0) {
    return ((buf[1] ?? 0) & 0x06) === 0 ? 'aac' : 'mp3';
  }
  if (buf.length >= 12 && ascii(4, 4) === 'ftyp') return 'm4a';
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'webm';
  }
  return 'unknown';
}

export const GNANI_REST_CONTAINERS: ReadonlySet<AudioContainer> = new Set([
  'wav',
  'mp3',
  'ogg',
  'flac',
  'aac',
  'm4a',
]);

const MIME: Record<AudioContainer, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
  unknown: 'application/octet-stream',
};

export function mimeForContainer(container: AudioContainer): string {
  return MIME[container];
}

/** Duration of a canonical PCM WAV in seconds, or undefined if the header is not parseable. */
export function wavDurationSeconds(buf: Uint8Array): number | undefined {
  if (sniffAudioContainer(buf) !== 'wav' || buf.length < 44) return undefined;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const byteRate = view.getUint32(28, true);
  if (byteRate === 0) return undefined;
  return Math.max(0, buf.length - 44) / byteRate;
}
