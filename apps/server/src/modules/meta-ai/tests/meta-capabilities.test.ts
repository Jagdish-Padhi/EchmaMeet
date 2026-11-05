import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BudgetExhaustedError,
  MeteredSam,
  MuseVoiceTranscriber,
  OpenAiCompatibleAdapter,
  SamSegmentationAdapter,
  UsageLedger,
  estimateTokenCostUsd,
  inspectWav,
  parseSamTokenText,
} from '../index';
import { usageMigrations } from '../migrations';
import { MeteredModel, MeteredVision } from '../index';
import { IN_MEMORY, openDatabase } from '../../../platform/db';
import { runMigrations } from '../../../platform/migrations';
import { systemClock } from '../../../platform/system-clock';

const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
});

interface Captured {
  url: string;
  headers: IncomingMessage['headers'];
  body: Buffer;
}

async function fakeProvider(
  respond: (req: Captured) => { status?: number; json: unknown },
): Promise<{ baseUrl: string; requests: Captured[] }> {
  const requests: Captured[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const captured = { url: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks) };
      requests.push(captured);
      const out = respond(captured);
      res.writeHead(out.status ?? 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out.json));
    });
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { baseUrl: `http://127.0.0.1:${String(port)}/v1`, requests };
}

/** Builds a PCM16 mono WAV; `amplitude` 0 yields digital silence. */
function wav(sampleRate: number, seconds: number, amplitude: number, channels = 1): Buffer {
  const samples = sampleRate * seconds * channels;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    data.writeInt16LE(Math.round(Math.sin(i / 20) * amplitude * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe('tool calling over the OpenAI-compatible wire protocol', () => {
  it('sends tool definitions, parses tool_calls, and returns usage for the ledger', async () => {
    const provider = await fakeProvider(() => ({
      json: {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_9',
                  type: 'function',
                  function: { name: 'get_edge_policy', arguments: '{"edgeId":"a-to-b"}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 812, completion_tokens: 31 },
      },
    }));
    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: provider.baseUrl,
      apiKey: 'k',
      modelId: 'muse-spark-1.3',
    });
    const res = await adapter.chatWithTools({
      messages: [{ role: 'user', content: 'go' }],
      tools: [
        {
          name: 'get_edge_policy',
          description: 'd',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });
    expect(res.toolCalls).toEqual([
      { id: 'call_9', name: 'get_edge_policy', arguments: { edgeId: 'a-to-b' } },
    ]);
    expect(res.metadata.tokenCounts).toEqual({ promptTokens: 812, completionTokens: 31 });
    const sent = JSON.parse(provider.requests[0]?.body.toString() ?? '{}') as {
      tools: { function: { name: string } }[];
      model: string;
    };
    expect(sent.model).toBe('muse-spark-1.3');
    expect(sent.tools[0]?.function.name).toBe('get_edge_policy');
    expect(provider.requests[0]?.headers.authorization).toBe('Bearer k');
  });
});

describe('SAM 3.1 via the Responses API', () => {
  it('parses token-text boxes into normalised masks and ignores malformed records', () => {
    const text =
      '<1f>0<|box;x1=100;y1=50;x2=300;y2=150;w=1000;h=500|><|mask;x=0;y=0;data=500,1000,rle:abc|>,' +
      '1<|box;x1=garbage|>,2<|box;x1=0;y1=0;x2=1000;y2=500;w=1000;h=500|>';
    const masks = parseSamTokenText(text, 'service box');
    expect(masks).toHaveLength(2);
    expect(masks[0]?.box).toEqual([0.1, 0.1, 0.3, 0.3]);
    expect(masks[1]?.box).toEqual([0, 0, 1, 1]);
  });

  it('posts model sam-3.1 with an input_image and reads output text', async () => {
    const provider = await fakeProvider(() => ({
      json: {
        output: [
          {
            content: [
              { type: 'output_text', text: '<1f>0<|box;x1=10;y1=20;x2=110;y2=120;w=200;h=200|>' },
            ],
          },
        ],
      },
    }));
    const sam = new SamSegmentationAdapter({ apiKey: 'k', baseUrl: provider.baseUrl });
    const res = await sam.segmentKeyframe('aGVsbG8=', 'red marker stroke line');
    expect(res.masks[0]?.box).toEqual([0.05, 0.1, 0.55, 0.6]);
    const sent = JSON.parse(provider.requests[0]?.body.toString() ?? '{}') as {
      model: string;
      input: { content: { type: string; image_url?: string }[] }[];
    };
    expect(provider.requests[0]?.url).toBe('/v1/responses');
    expect(sent.model).toBe('sam-3.1');
    expect(
      sent.input[0]?.content.some(
        (c) => c.type === 'input_image' && c.image_url?.startsWith('data:image/png;base64,'),
      ),
    ).toBe(true);
  });

  it('raises a typed error on HTTP failure rather than returning empty masks', async () => {
    const provider = await fakeProvider(() => ({ status: 429, json: { error: 'slow down' } }));
    const sam = new SamSegmentationAdapter({ apiKey: 'k', baseUrl: provider.baseUrl });
    await expect(sam.segmentKeyframe('aGVsbG8=', 'x')).rejects.toMatchObject({
      errorClass: 'transport_error',
    });
  });
});

describe('Muse Voice Transcribe batch endpoint', () => {
  it('validates WAV format before spending money', async () => {
    const provider = await fakeProvider(() => ({ json: { transcript: 'x', turns: [] } }));
    const stt = new MuseVoiceTranscriber({ apiKey: 'k', baseUrl: provider.baseUrl });
    await expect(stt.transcribeWav(Buffer.from('not a wav'))).rejects.toThrow(/PCM16 mono WAV/);
    await expect(stt.transcribeWav(wav(44_100, 1, 0.3))).rejects.toThrow(/16 kHz or 24 kHz/);
    await expect(stt.transcribeWav(wav(16_000, 1, 0.3, 2))).rejects.toThrow(/mono/);
    expect(provider.requests).toHaveLength(0);
    expect(inspectWav(wav(16_000, 2, 0.3))?.durationMs).toBe(2000);
  });

  it('skips silent audio locally and bills nothing', async () => {
    const provider = await fakeProvider(() => ({ json: { transcript: 'ghost', turns: [] } }));
    const stt = new MuseVoiceTranscriber({ apiKey: 'k', baseUrl: provider.baseUrl });
    const res = await stt.transcribeWav(wav(16_000, 3, 0));
    expect(res.skippedAsSilence).toBe(true);
    expect(res.billedAudioMs).toBe(0);
    expect(provider.requests).toHaveLength(0);
  });

  it('sends a multipart request/audio pair and maps turns and speakers', async () => {
    const provider = await fakeProvider(() => ({
      json: {
        sessionId: 's1',
        transcript: ' retries are set to five ',
        audioDurationMs: 2000,
        turns: [
          {
            turnId: 't1',
            startMs: 0,
            endMs: 1900,
            transcript: 'retries are set to five',
            speaker: 'S1',
          },
        ],
      },
    }));
    const stt = new MuseVoiceTranscriber({
      apiKey: 'k',
      baseUrl: provider.baseUrl,
      mode: 'DIARIZATION',
    });
    const res = await stt.transcribeWav(wav(16_000, 2, 0.4));
    expect(res.transcript).toBe('retries are set to five');
    expect(res.turns[0]?.speaker).toBe('S1');
    expect(res.billedAudioMs).toBe(2000);
    const req = provider.requests[0];
    expect(req?.url).toBe('/v1/asr/transcribe');
    expect(req?.headers['content-type']).toMatch(/^multipart\/form-data/);
    const raw = req?.body.toString('latin1') ?? '';
    expect(raw).toContain('name="request"');
    expect(raw).toContain('"audioEncoding":"WAV"');
    expect(raw).toContain('"mode":"DIARIZATION"');
    expect(raw).toContain('name="audio"');
    expect(raw).toContain('RIFF');
  });

  it('maps provider rate limiting to a retryable transport error', async () => {
    const provider = await fakeProvider(() => ({ status: 429, json: { error: 'rate' } }));
    const stt = new MuseVoiceTranscriber({ apiKey: 'k', baseUrl: provider.baseUrl });
    await expect(stt.transcribeWav(wav(16_000, 1, 0.4))).rejects.toMatchObject({
      errorClass: 'transport_error',
    });
  });
});

describe('usage ledger and budget guard', () => {
  function ledger(budget: number, reserve: number) {
    const db = openDatabase(IN_MEMORY);
    runMigrations(db, [usageMigrations], systemClock);
    return new UsageLedger(db, budget, reserve);
  }

  it('prices tokens from the Meta catalogue', () => {
    // 1M input + 1M output on Muse Spark 1.3 = $1.25 + $4.25
    expect(estimateTokenCostUsd('muse-spark-1.3', 1_000_000, 1_000_000)).toBeCloseTo(5.5, 6);
    expect(estimateTokenCostUsd('meta-models/muse-wonder-1.0', 1_000_000, 0)).toBeCloseTo(4, 6);
    // An unknown model is never free: it is billed at the most expensive known rate.
    expect(estimateTokenCostUsd('unknown-model', 1_000_000, 1_000_000)).toBeCloseTo(24, 6);
  });

  it('stops spend at budget minus reserve so the demo money cannot be consumed', () => {
    const l = ledger(10, 4); // usable ceiling $6
    l.record({ capability: 'repair', provider: 'meta', modelId: 'muse-wonder-1.0', costUsd: 5.9 });
    expect(() => l.assertWithinBudget()).not.toThrow();
    l.record({ capability: 'repair', provider: 'meta', modelId: 'muse-wonder-1.0', costUsd: 0.2 });
    expect(() => l.assertWithinBudget()).toThrow(BudgetExhaustedError);
    expect(l.summary().remainingUsableUsd).toBe(0);
    expect(l.summary().byCapability[0]?.calls).toBe(2);
  });

  it('meters SAM calls per image and refuses once exhausted', async () => {
    const l = ledger(1, 0);
    const inner = { segmentKeyframe: () => Promise.resolve({ masks: [] }) };
    const sam = new MeteredSam(inner, l);
    await sam.segmentKeyframe('x', 'p');
    expect(l.totalUsd()).toBeCloseTo(0.0025, 6);
    l.record({ capability: 'x', provider: 'meta', modelId: 'm', costUsd: 5 });
    await expect(sam.segmentKeyframe('x', 'p')).rejects.toBeInstanceOf(BudgetExhaustedError);
  });

  describe('concurrency, unknown models and missing usage', () => {
    const meta = (
      modelId: string,
      tokenCounts?: { promptTokens: number; completionTokens: number },
    ) => ({
      provider: 'meta',
      modelId,
      promptVersion: 'v',
      latencyMs: 1,
      ...(tokenCounts ? { tokenCounts } : {}),
    });

    it('rejects a burst of concurrent calls once their reservations would exceed the ceiling', async () => {
      const l = ledger(1, 0); // $1 usable
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const inner = {
        generateStructured: async () => {
          await gate; // every call is in flight before any has been recorded
          return {
            data: {},
            rawOutput: '{}',
            metadata: meta('muse-wonder-1.0', { promptTokens: 10, completionTokens: 10 }),
          };
        },
      };
      const model = new MeteredModel(inner as never, l, 'repair', 'muse-wonder-1.0');
      // Each call reserves ~ (6000/3 prompt + 8000 completion) tokens of Wonder = ~$0.17.
      const call = () =>
        model.generateStructured({
          messages: [{ role: 'user', content: 'x'.repeat(6000) }],
          maxTokens: 8000,
        } as never);
      const resultsPromise = Promise.allSettled(Array.from({ length: 10 }, () => call()));
      await new Promise((r) => setTimeout(r, 20)); // all calls are now reserved or rejected
      release();
      const results = await resultsPromise;
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected.length).toBeGreaterThan(0);
      expect(rejected[0]).toMatchObject({ reason: expect.any(BudgetExhaustedError) });
      // Nothing was spent beyond what was recorded, and no reservation leaked.
      expect(l.summary().reservedUsd).toBe(0);
    });

    it('releases the reservation when the provider call fails', async () => {
      const l = ledger(10, 0);
      const model = new MeteredModel(
        { generateStructured: () => Promise.reject(new Error('boom')) } as never,
        l,
        'repair',
        'muse-spark-1.3',
      );
      await expect(
        model.generateStructured({ messages: [{ role: 'user', content: 'x' }] } as never),
      ).rejects.toThrow('boom');
      expect(l.summary().reservedUsd).toBe(0);
      expect(l.totalUsd()).toBe(0);
    });

    it('records the worst-case estimate, flagged, when the provider returns no usage', async () => {
      const l = ledger(10, 0);
      const model = new MeteredModel(
        {
          generateStructured: () =>
            Promise.resolve({ data: {}, rawOutput: '{}', metadata: meta('muse-spark-1.3') }),
        } as never,
        l,
        'copilot',
        'muse-spark-1.3',
      );
      await model.generateStructured({
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 1000,
      } as never);
      expect(l.totalUsd()).toBeGreaterThan(0);
      expect(l.summary().unpricedCalls).toBe(1);
    });

    it('flags calls to models with no catalogue price instead of recording zero', async () => {
      const l = ledger(10, 0);
      const model = new MeteredModel(
        {
          generateStructured: () =>
            Promise.resolve({
              data: {},
              rawOutput: '{}',
              metadata: meta('some-new-model', { promptTokens: 1000, completionTokens: 1000 }),
            }),
        } as never,
        l,
        'default',
        'some-new-model',
      );
      await model.generateStructured({ messages: [{ role: 'user', content: 'x' }] } as never);
      expect(l.totalUsd()).toBeGreaterThan(0);
      expect(l.summary().unpricedCalls).toBe(1);
    });

    it('meters vision-language extraction like every other billable call', async () => {
      const l = ledger(10, 0);
      const vision = new MeteredVision(
        {
          extractTopologyFromImage: () =>
            Promise.resolve({
              data: { nodes: [], edges: [], warnings: [] } as never,
              rawOutput: '{}',
              metadata: meta('muse-spark-1.1', { promptTokens: 2000, completionTokens: 500 }),
            }),
        },
        l,
        'muse-spark-1.1',
      );
      await vision.extractTopologyFromImage('aGVsbG8=', 'image/png');
      const row = l.summary().byCapability.find((c) => c.capability === 'vision');
      expect(row?.calls).toBe(1);
      expect(row?.costUsd).toBeCloseTo((2000 * 1.25 + 500 * 4.25) / 1_000_000, 8);
    });
  });
});
