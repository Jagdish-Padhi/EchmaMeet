import { describe, expect, it } from 'vitest';
import { GnaniSttClient } from '../infrastructure/gnani-stt-client';
import { GnaniTtsClient } from '../infrastructure/gnani-tts-client';
import { asciiJson, buildRealtimeHeaders } from '../infrastructure/gnani-realtime-stt';
import { GnaniError, classifyHttpFailure } from '../domain/errors';
import {
  detectLanguageFromScript,
  normalizeLanguageSelection,
  resolveVoice,
} from '../domain/languages';
import { sniffAudioContainer, wavDurationSeconds } from '../domain/audio';
import { withRetry } from '../infrastructure/retry';

function wav(seconds = 1, sampleRate = 16000): Uint8Array {
  const dataBytes = seconds * sampleRate * 2;
  const buf = new Uint8Array(44 + dataBytes);
  const v = new DataView(buf.buffer);
  buf.set([0x52, 0x49, 0x46, 0x46], 0);
  v.setUint32(4, 36 + dataBytes, true);
  buf.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  buf.set([0x64, 0x61, 0x74, 0x61], 36);
  v.setUint32(40, dataBytes, true);
  return buf;
}

const sttConfig = {
  apiKey: 'k',
  baseUrl: 'https://api.test',
  model: 'prisma-v3.0' as const,
  timeoutMs: 1000,
  maxAttempts: 1,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('language helpers', () => {
  it('accepts indic-auto and up to four distinct codes', () => {
    expect(normalizeLanguageSelection('')).toBe('indic-auto');
    expect(normalizeLanguageSelection('hi-IN, en-IN,hi-IN')).toBe('hi-IN,en-IN');
    expect(() => normalizeLanguageSelection('hi-IN,en-IN,ta-IN,te-IN,kn-IN')).toThrow(RangeError);
    expect(() => normalizeLanguageSelection('as-IN')).toThrow(/Unsupported/);
  });

  it('picks per-model voices', () => {
    expect(resolveVoice('timbre-v2.5', 'hi-IN')).toBe('Nalini');
    expect(resolveVoice('timbre-v3.0', 'ta-IN')).toBe('Shivani');
    expect(resolveVoice('timbre-v2.5', 'hi-IN', 'Bhavna')).toBe('Bhavna');
  });

  it('detects language from script', () => {
    expect(detectLanguageFromScript('नमस्ते आप कैसे हैं')).toBe('hi-IN');
    expect(detectLanguageFromScript('வணக்கம்')).toBe('ta-IN');
    expect(detectLanguageFromScript('hello there')).toBe('en-IN');
    expect(detectLanguageFromScript('12345')).toBeUndefined();
  });
});

describe('audio sniffing', () => {
  it('recognises containers and WAV duration', () => {
    expect(sniffAudioContainer(wav(2))).toBe('wav');
    expect(wavDurationSeconds(wav(2))).toBeCloseTo(2, 3);
    expect(sniffAudioContainer(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).toBe('webm');
    expect(sniffAudioContainer(new Uint8Array([1, 2, 3, 4]))).toBe('unknown');
  });
});

describe('GnaniSttClient', () => {
  it('posts multipart with the documented fields and parses the response', async () => {
    let seen: { url: string; headers: Headers; form: FormData } | undefined;
    const client = new GnaniSttClient({
      ...sttConfig,
      fetchImpl: (async (url: string, init: RequestInit) => {
        seen = { url, headers: new Headers(init.headers), form: init.body as FormData };
        return json({
          success: true,
          request_id: 'r1',
          transcript: 'gateway से backend पर 300 ms latency',
          model: 'prisma-v3.0',
          detected_language_code: 'hi-IN',
        });
      }) as unknown as typeof fetch,
    });
    const result = await client.transcribe({
      audio: wav(1),
      language: 'hi-IN,en-IN',
      keyterms: ['gateway', 'backend'],
    });
    expect(seen?.url).toBe('https://api.test/stt/v3');
    expect(seen?.headers.get('x-api-key-id')).toBe('k');
    expect(seen?.form.get('model')).toBe('prisma-v3.0');
    expect(seen?.form.get('language_code')).toBe('hi-IN,en-IN');
    expect(seen?.form.get('format')).toBe('transcribe');
    expect(JSON.parse(String(seen?.form.get('keyterms')))).toEqual(['gateway', 'backend']);
    expect(result.language).toBe('hi-IN');
    expect(result.requestId).toBe('r1');
  });

  it('rejects webm before spending credits and clips over 30 seconds', async () => {
    const client = new GnaniSttClient({
      ...sttConfig,
      fetchImpl: (() => {
        throw new Error('no call');
      }) as never,
    });
    await expect(
      client.transcribe({
        audio: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]),
      }),
    ).rejects.toMatchObject({ failure: 'unsupported_audio' });
    await expect(client.transcribe({ audio: wav(31) })).rejects.toMatchObject({
      failure: 'bad_request',
    });
  });

  it('retries rate limits then succeeds', async () => {
    let calls = 0;
    const client = new GnaniSttClient({
      ...sttConfig,
      maxAttempts: 3,
      fetchImpl: (async () => {
        calls += 1;
        return calls < 3
          ? json({ success: false, error: { type: 'RATE_LIMITED', message: 'slow down' } }, 429)
          : json({ success: true, transcript: 'ok', model: 'prisma-v3.0' });
      }) as unknown as typeof fetch,
    });
    const result = await client.transcribe({ audio: wav(1) });
    expect(calls).toBe(3);
    expect(result.transcript).toBe('ok');
  });

  it('does not retry auth failures', async () => {
    let calls = 0;
    const client = new GnaniSttClient({
      ...sttConfig,
      maxAttempts: 3,
      fetchImpl: (async () => {
        calls += 1;
        return json({ success: false, error: { type: 'UNAUTHORIZED', message: 'bad key' } }, 401);
      }) as unknown as typeof fetch,
    });
    await expect(client.transcribe({ audio: wav(1) })).rejects.toMatchObject({
      failure: 'unauthorized',
    });
    expect(calls).toBe(1);
  });

  it('falls back to Prisma v2.5 when the account lacks v3.0', async () => {
    const models: string[] = [];
    const client = new GnaniSttClient({
      ...sttConfig,
      fetchImpl: (async (_u: string, init: RequestInit) => {
        const model = String((init.body as FormData).get('model'));
        models.push(model);
        return model === 'prisma-v3.0'
          ? json(
              { success: false, error: { type: 'INVALID_MODEL', message: 'model not enabled' } },
              400,
            )
          : json({ success: true, transcript: 'नमस्ते', model: 'prisma-v2.5' });
      }) as unknown as typeof fetch,
    });
    const result = await client.transcribe({ audio: wav(1), language: 'hi-IN' });
    expect(models).toEqual(['prisma-v3.0', 'prisma-v2.5']);
    expect(result.model).toBe('prisma-v2.5');
    expect(result.language).toBe('hi-IN');
  });

  it('reports a missing key without any network call', async () => {
    const client = new GnaniSttClient({ ...sttConfig, apiKey: '' });
    await expect(client.transcribe({ audio: wav(1) })).rejects.toMatchObject({
      failure: 'not_configured',
    });
  });
});

describe('GnaniTtsClient', () => {
  it('sends the documented payload and returns audio bytes', async () => {
    let body: Record<string, unknown> = {};
    const client = new GnaniTtsClient({
      apiKey: 'k',
      baseUrl: 'https://api.test',
      model: 'timbre-v2.5',
      timeoutMs: 1000,
      maxAttempts: 1,
      sampleRate: 48000,
      fetchImpl: (async (url: string, init: RequestInit) => {
        expect(url).toBe('https://api.test/api/v1/tts/inference');
        body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'audio/wav' },
        });
      }) as unknown as typeof fetch,
    });
    const out = await client.synthesize({ text: 'नमस्ते', language: 'hi-IN' });
    expect(body['voice']).toBe('Nalini');
    expect(body['model']).toBe('timbre-v2.5');
    expect(body['language']).toBe('hi-IN');
    expect((body['audio_config'] as Record<string, unknown>)['container']).toBe('wav');
    expect([...out.audio]).toEqual([1, 2, 3]);
  });

  it('rejects empty text', async () => {
    const client = new GnaniTtsClient({
      apiKey: 'k',
      baseUrl: 'x',
      model: 'timbre-v2.5',
      timeoutMs: 1,
      maxAttempts: 1,
      sampleRate: 48000,
    });
    await expect(client.synthesize({ text: '   ', language: 'en-IN' })).rejects.toBeInstanceOf(
      GnaniError,
    );
  });
});

describe('realtime headers', () => {
  const base = { apiKey: 'k', wsBaseUrl: 'wss://api.test', model: 'prisma-v3.0' as const };

  it('uses the v3.0 headers, escapes Indic keyterms and applies the telephony VAD preset', () => {
    const h = buildRealtimeHeaders(base, {
      language: 'hi-IN,en-IN',
      sampleRate: 8000,
      keyterms: ['खाता', 'gateway'],
    });
    expect(h['x-model']).toBe('prisma-v3.0');
    expect(h['lang_code']).toBe('hi-IN,en-IN');
    expect(h['x-sample-rate']).toBe('8000');
    expect(h['x-vad-threshold']).toBe('0.7');
    expect(h['x-min-speech-ms']).toBe('200');
    expect(h['x-keyterms']).toBe('["\\u0916\\u093e\\u0924\\u093e","gateway"]');
    expect(/^[\x20-\x7e]+$/.test(h['x-keyterms'] ?? '')).toBe(true);
  });

  it('uses bias-list for v2.5 with letters-only words and a single language', () => {
    const h = buildRealtimeHeaders(
      { ...base, model: 'prisma-v2.5' },
      {
        language: 'hi-IN,en-IN',
        sampleRate: 16000,
        keyterms: ['gateway', 'circuit breaker', 'p99'],
      },
    );
    expect(h['x-model']).toBeUndefined();
    expect(h['lang_code']).toBe('en-IN');
    expect(JSON.parse(h['x-bias-list'] ?? '[]')).toEqual(['gateway']);
    expect(h['x-bias-score']).toBe('1.0');
  });

  it('asciiJson escapes non-ASCII', () => {
    expect(asciiJson(['é'])).toBe('["\\u00e9"]');
  });
});

describe('error classification and retry', () => {
  it('maps statuses', () => {
    expect(classifyHttpFailure(429, {}).failure).toBe('rate_limited');
    expect(classifyHttpFailure(504, {}).failure).toBe('timeout');
    expect(classifyHttpFailure(503, {}).retryable).toBe(true);
    expect(
      classifyHttpFailure(422, { error: { message: 'language_code missing' } }).message,
    ).toContain('language_code missing');
  });

  it('withRetry uses full-jitter backoff and stops at maxAttempts', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new GnaniError('upstream', 'boom');
        },
        {
          maxAttempts: 3,
          baseDelayMs: 100,
          random: () => 1,
          sleep: async (ms) => void sleeps.push(ms),
        },
      ),
    ).rejects.toBeInstanceOf(GnaniError);
    expect(calls).toBe(3);
    expect(sleeps).toEqual([100, 200]);
  });
});
