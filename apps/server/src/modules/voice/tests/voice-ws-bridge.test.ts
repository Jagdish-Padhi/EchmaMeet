import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { MemoryVoiceLedger } from '../../voice-ledger';
import { VoiceService } from '../application/voice-service';
import { attachVoiceWebSocketBridge } from '../infrastructure/voice-ws-bridge';

interface FakeGnani {
  readonly url: string;
  readonly headers: () => IncomingMessage['headers'] | undefined;
  readonly frames: () => number[];
  close(): Promise<void>;
}

/** Minimal stand-in for wss://api.vachana.ai/stt/v3/stream. */
async function startFakeGnani(transcript: string): Promise<FakeGnani> {
  const server = createServer();
  const wss = new WebSocketServer({ server });
  let seen: IncomingMessage['headers'] | undefined;
  const frames: number[] = [];
  let replied = false;
  wss.on('connection', (ws, req) => {
    seen = req.headers;
    ws.send(JSON.stringify({ type: 'connected' }));
    ws.on('message', (data: Buffer) => {
      frames.push(data.length);
      // Pretend the VAD closed the segment after ~6 frames (the silence padding).
      if (frames.length >= 6 && !replied) {
        replied = true;
        ws.send(JSON.stringify({ type: 'processing' }));
        ws.send(
          JSON.stringify({
            type: 'transcript',
            text: transcript,
            latency: 123,
            segment_index: 0,
            detected_language_code: 'hi-IN',
          }),
        );
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `ws://127.0.0.1:${String(port)}`,
    headers: () => seen,
    frames: () => frames,
    close: () =>
      new Promise((resolve) => {
        for (const c of wss.clients) c.terminate();
        wss.close(() => server.close(() => resolve()));
      }),
  };
}

describe('voice websocket bridge with Gnani streaming', () => {
  const closers: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of closers.splice(0)) await c();
  });

  it('streams paced 1024-byte PCM frames and returns transcript, intent and spoken reply', async () => {
    const gnani = await startFakeGnani('gateway se backend par 300 ms latency inject karo');
    closers.push(() => gnani.close());

    const ledger = new MemoryVoiceLedger();
    const synthCalls: { text: string; language: string }[] = [];
    const service = new VoiceService({
      ledger,
      stt: { model: 'prisma-v3.0', transcribe: () => Promise.reject(new Error('unused')) },
      tts: {
        synthesize: (req) => {
          synthCalls.push({ text: req.text, language: req.language });
          return Promise.resolve({
            audio: new Uint8Array([82, 73, 70, 70]),
            contentType: 'audio/wav',
            voice: 'Nalini',
            model: 'timbre-v2.5',
            latencyMs: 40,
          });
        },
      },
    });

    const http: Server = createServer();
    attachVoiceWebSocketBridge(http, service, {
      authenticate: (t) => t === 'good-token',
      realtime: { apiKey: 'secret-key', wsBaseUrl: gnani.url, model: 'prisma-v3.0' },
    });
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    closers.push(() => new Promise((r) => http.close(() => r())));
    const port = (http.address() as AddressInfo).port;

    // Unauthenticated upgrade is refused.
    await expect(
      new Promise((resolve, reject) => {
        const bad = new WebSocket(`ws://127.0.0.1:${String(port)}/ws/voice?token=nope`);
        bad.on('open', () => resolve(bad));
        bad.on('error', reject);
      }),
    ).rejects.toThrow();

    const client = new WebSocket(`ws://127.0.0.1:${String(port)}/ws/voice?token=good-token`);
    const got: { type: string; [k: string]: unknown }[] = [];
    client.on('message', (raw) =>
      got.push(JSON.parse((raw as Buffer).toString('utf8')) as { type: string }),
    );
    await new Promise((r) => client.on('open', r));

    client.send(
      JSON.stringify({
        type: 'start',
        language: 'hi-IN,en-IN',
        sampleRate: 16000,
        speakReplies: true,
        nodes: [
          { id: 'gateway', label: 'API Gateway' },
          { id: 'backend', label: 'Backend' },
        ],
        edges: [{ id: 'e1', source: 'gateway', target: 'backend' }],
      }),
    );
    await waitFor(() => got.some((m) => m.type === 'ready'));

    // 8 KiB of arbitrary-sized PCM chunks; the bridge must re-frame to exactly 1024 bytes.
    for (let i = 0; i < 8; i += 1) client.send(Buffer.alloc(1000, 1));
    client.send(JSON.stringify({ type: 'end_utterance', audioDurationMs: 500 }));

    await waitFor(() => got.some((m) => m.type === 'speech_reply'), 4000);

    const headers = gnani.headers();
    expect(headers?.['x-api-key-id']).toBe('secret-key');
    expect(headers?.['x-model']).toBe('prisma-v3.0');
    expect(headers?.['lang_code']).toBe('hi-IN,en-IN');
    expect(headers?.['x-sample-rate']).toBe('16000');
    expect(String(headers?.['x-keyterms'])).toContain('API Gateway');

    expect(gnani.frames().length).toBeGreaterThanOrEqual(6);
    expect(gnani.frames().every((n) => n === 1024)).toBe(true);

    const final = got.find((m) => m.type === 'transcript_final');
    expect(final).toMatchObject({ language: 'hi-IN', latencyMs: 123 });
    const intent = got.find((m) => m.type === 'intent_parsed') as unknown as {
      result: { status: string; command: { command: string; source: string; target: string } };
    };
    expect(intent.result.status).toBe('parsed');
    expect(intent.result.command).toMatchObject({
      command: 'inject_fault',
      source: 'gateway',
      target: 'backend',
    });
    const speech = got.find((m) => m.type === 'speech_reply');
    expect(speech).toMatchObject({ voice: 'Nalini', language: 'hi-IN' });
    expect(synthCalls[0]?.language).toBe('hi-IN');
    expect(synthCalls[0]?.text).toContain('मिलीसेकंड');

    const stats = await ledger.analytics();
    expect(stats.total).toBe(1);
    expect(stats.byLanguage[0]?.language).toBe('hi-IN');
    client.close();
  });

  it('reports a clear error when streaming is not configured', async () => {
    const http = createServer();
    attachVoiceWebSocketBridge(http, new VoiceService({}), {});
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    closers.push(() => new Promise((r) => http.close(() => r())));
    const port = (http.address() as AddressInfo).port;
    const client = new WebSocket(`ws://127.0.0.1:${String(port)}/ws/voice`);
    const got: { type: string; message?: string }[] = [];
    client.on('message', (raw) => got.push(JSON.parse((raw as Buffer).toString('utf8')) as never));
    await new Promise((r) => client.on('open', r));
    client.send(JSON.stringify({ type: 'start', language: 'indic-auto' }));
    await waitFor(() => got.some((m) => m.type === 'error'));
    expect(got.find((m) => m.type === 'error')?.message).toContain('GNANI_API_KEY');
    client.close();
  });
});

async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 20));
  }
}
