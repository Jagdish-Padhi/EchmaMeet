import { WebSocket } from 'ws';
import { GnaniError } from '../domain/errors';
import { normalizeLanguageSelection } from '../domain/languages';

export interface RealtimeSttConfig {
  readonly apiKey: string;
  /** e.g. wss://api.vachana.ai */
  readonly wsBaseUrl: string;
  readonly model: 'prisma-v3.0' | 'prisma-v2.5';
}

export interface RealtimeSttOptions {
  readonly language: string;
  readonly sampleRate: 8000 | 16000;
  readonly keyterms?: readonly string[] | undefined;
  readonly format?: 'verbatim' | 'transcribe' | 'codemix' | 'transliterate' | undefined;
}

export interface RealtimeSttHandlers {
  onReady(): void;
  onProcessing(): void;
  onTranscript(event: {
    text: string;
    latencyMs: number;
    segmentIndex: number;
    language?: string | undefined;
  }): void;
  onError(error: GnaniError): void;
  onClose(): void;
}

function rawToString(raw: Buffer | ArrayBuffer | Buffer[]): string {
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  return Buffer.from(raw).toString('utf8');
}

const FRAME_BYTES = 1024; // 512 samples x 16-bit mono: required by the Gnani streaming protocol.

/** Non-ASCII characters in header values must be JSON \u-escaped to survive HTTP headers. */
export function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u0080-\uFFFF]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

export function buildRealtimeHeaders(
  config: RealtimeSttConfig,
  options: RealtimeSttOptions,
): Record<string, string> {
  const language = normalizeLanguageSelection(options.language);
  const v3 = config.model === 'prisma-v3.0';
  const telephony = options.sampleRate === 8000;
  const headers: Record<string, string> = {
    'x-api-key-id': config.apiKey,
    lang_code: v3 || !language.includes(',') ? language : 'en-IN',
    'x-sample-rate': String(options.sampleRate),
    'x-format': options.format ?? 'transcribe',
    // VAD presets from the Gnani docs: telephony is stricter, a clean mic is more sensitive.
    'x-vad-threshold': telephony ? '0.7' : '0.55',
    'x-min-silence-ms': telephony ? '500' : '600',
    ...(telephony ? { 'x-min-speech-ms': '200' } : {}),
  };
  if (v3) headers['x-model'] = 'prisma-v3.0';
  const terms = (options.keyterms ?? []).filter((t) => t.trim() !== '').slice(0, 200);
  if (terms.length > 0) {
    // v3.0 takes phrases via x-keyterms; v2.5 only takes single letter-only words via x-bias-list.
    if (v3) headers['x-keyterms'] = asciiJson(terms);
    else {
      const words = terms.filter((t) => /^\p{L}+$/u.test(t)).slice(0, 100);
      if (words.length > 0) {
        headers['x-bias-list'] = asciiJson(words);
        headers['x-bias-score'] = '1.0';
      }
    }
  }
  return headers;
}

/**
 * One server-side streaming session to Gnani Prisma. Browsers cannot set WebSocket headers,
 * so the control plane holds the API key and the connection, and re-frames incoming PCM into
 * the exact 1024-byte frames at real-time cadence that the Gnani VAD requires.
 */
export class RealtimeSttSession {
  private socket: WebSocket | undefined;
  private queue: Buffer[] = [];
  private queuedBytes = 0;
  private pacer: NodeJS.Timeout | undefined;
  private closed = false;
  private readonly frameIntervalMs: number;

  constructor(
    private readonly config: RealtimeSttConfig,
    private readonly options: RealtimeSttOptions,
    private readonly handlers: RealtimeSttHandlers,
  ) {
    // 512 samples per frame: 32 ms at 16 kHz, 64 ms at 8 kHz.
    this.frameIntervalMs = (512 / options.sampleRate) * 1000;
  }

  open(): Promise<void> {
    if (!this.config.apiKey) {
      return Promise.reject(new GnaniError('not_configured', 'GNANI_API_KEY is not set.'));
    }
    const headers = buildRealtimeHeaders(this.config, this.options);
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`${this.config.wsBaseUrl}/stt/v3/stream`, { headers });
      this.socket = socket;
      let settled = false;
      socket.on('open', () => {
        this.pacer = setInterval(() => this.drain(), this.frameIntervalMs);
      });
      socket.on('message', (raw, isBinary) => {
        if (isBinary) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(rawToString(raw)) as Record<string, unknown>;
        } catch {
          return;
        }
        switch (msg['type']) {
          case 'connected':
            if (!settled) {
              settled = true;
              resolve();
            }
            this.handlers.onReady();
            break;
          case 'processing':
            this.handlers.onProcessing();
            break;
          case 'transcript': {
            const text = typeof msg['text'] === 'string' ? msg['text'].trim() : '';
            if (text === '') break;
            this.handlers.onTranscript({
              text,
              latencyMs: typeof msg['latency'] === 'number' ? Math.round(msg['latency']) : 0,
              segmentIndex: typeof msg['segment_index'] === 'number' ? msg['segment_index'] : 0,
              ...(typeof msg['detected_language_code'] === 'string'
                ? { language: msg['detected_language_code'] }
                : {}),
            });
            break;
          }
          case 'error': {
            const message = typeof msg['message'] === 'string' ? msg['message'] : 'Gnani STT error';
            const error = new GnaniError(
              /limit|rate/i.test(message) ? 'rate_limited' : 'upstream',
              message,
            );
            if (!settled) {
              settled = true;
              reject(error);
            }
            this.handlers.onError(error);
            break;
          }
          default:
            break;
        }
      });
      socket.on('unexpected-response', (_req, res) => {
        const error = new GnaniError(
          res.statusCode === 401 || res.statusCode === 403 ? 'unauthorized' : 'upstream',
          `Gnani STT handshake failed with HTTP ${String(res.statusCode)}.`,
          { upstreamStatus: res.statusCode },
        );
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      socket.on('error', (cause) => {
        const error = new GnaniError('upstream', 'Gnani STT connection error.', { cause });
        if (!settled) {
          settled = true;
          reject(error);
        } else this.handlers.onError(error);
      });
      socket.on('close', () => {
        this.stopPacer();
        if (!this.closed) {
          this.closed = true;
          this.handlers.onClose();
        }
      });
    });
  }

  /** Queue raw 16-bit little-endian mono PCM at the session sample rate. */
  sendPcm(chunk: Buffer): void {
    if (this.closed) return;
    this.queue.push(chunk);
    this.queuedBytes += chunk.length;
    // Backpressure: never hold more than ~10 s of audio if the network stalls.
    const maxBytes = this.options.sampleRate * 2 * 10;
    while (this.queuedBytes > maxBytes && this.queue.length > 1) {
      const dropped = this.queue.shift();
      this.queuedBytes -= dropped?.length ?? 0;
    }
  }

  /** Pad with silence so the server-side VAD closes the current segment (push-to-talk release). */
  endUtterance(silenceMs = 800): void {
    const bytes = Math.ceil((silenceMs / 1000) * this.options.sampleRate) * 2;
    this.sendPcm(Buffer.alloc(bytes));
  }

  close(): void {
    this.closed = true;
    this.stopPacer();
    this.queue = [];
    this.queuedBytes = 0;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close();
  }

  private drain(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN || this.queuedBytes < FRAME_BYTES) return;
    const joined = Buffer.concat(this.queue);
    const frame = joined.subarray(0, FRAME_BYTES);
    const rest = joined.subarray(FRAME_BYTES);
    this.queue = rest.length > 0 ? [rest] : [];
    this.queuedBytes = rest.length;
    socket.send(frame);
  }

  private stopPacer(): void {
    if (this.pacer) clearInterval(this.pacer);
    this.pacer = undefined;
  }
}
