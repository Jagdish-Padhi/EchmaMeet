/**
 * Live verification of every Meta capability EchmaMeet depends on, against YOUR key.
 *
 * It records, for each capability, the exact status/latency/shape the real API returned so that
 * docs/api-notes.md can state facts rather than hypotheses. A rejected request is a result, not a
 * crash. Estimated total spend is a few cents.
 *
 * Environment: META_API_KEY (or PARTNER_API_KEY), optional META_API_BASE_URL (default
 * https://api.meta.ai/v1), PARTNER_MODEL_ID (default muse-spark-1.3), META_SAM_MODEL_ID,
 * VISION_MODEL_ID.
 */
import { deflateSync } from 'node:zlib';
import { timedFetch } from './lib/http';
import { createRecorder } from './lib/recorder';

const key = process.env['META_API_KEY'] || process.env['PARTNER_API_KEY'] || '';
if (!key) {
  console.error('Set META_API_KEY (or PARTNER_API_KEY) to run the live Meta smoke test.');
  process.exit(2);
}
const base = (process.env['META_API_BASE_URL'] ?? 'https://api.meta.ai/v1').replace(/\/$/, '');
const chatModel = process.env['PARTNER_MODEL_ID'] || 'muse-spark-1.3';
const samModel = process.env['META_SAM_MODEL_ID'] || 'sam-3.1';
const visionModel = process.env['VISION_MODEL_ID'] || 'muse-spark-1.1';
const recorder = createRecorder('meta-capabilities');
const auth = { authorization: `Bearer ${key}` };

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A 128x96 white PNG with one black rectangle and a red diagonal stroke. */
function samplePng(): string {
  const w = 128;
  const h = 96;
  const raw = Buffer.alloc((w * 3 + 1) * h, 255);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x += 1) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const rect = x > 20 && x < 60 && y > 20 && y < 60;
      const edge = rect && (x < 23 || x > 57 || y < 23 || y > 57);
      const stroke = Math.abs(x - 60 - (y - 20)) < 2 && x > 60 && x < 110;
      if (edge) raw.fill(0, o, o + 3);
      if (stroke) {
        raw[o] = 230;
        raw[o + 1] = 20;
        raw[o + 2] = 20;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}
/** One second of a 440 Hz tone as PCM16 mono 16 kHz WAV. */
function toneWav(): Buffer {
  const rate = 16_000;
  const data = Buffer.alloc(rate * 2);
  for (let i = 0; i < rate; i += 1)
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

async function step(name: string, run: () => Promise<Record<string, unknown>>): Promise<void> {
  try {
    const data = await run();
    recorder.add(name, data);
    console.log(`  ok   ${name}`, JSON.stringify(data).slice(0, 160));
  } catch (error) {
    recorder.add(name, { error: error instanceof Error ? error.message : String(error) });
    console.log(`  FAIL ${name}`, error instanceof Error ? error.message : error);
  }
}

console.log(`Meta live smoke test against ${base}`);

await step('chat.tool_calling', async () => {
  const res = await timedFetch(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: 'user', content: 'What is the policy of edge a-to-b? Use the tool.' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_edge_policy',
              description: 'Get an edge policy',
              parameters: {
                type: 'object',
                properties: { edgeId: { type: 'string' } },
                required: ['edgeId'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        max_tokens: 200,
      }),
    },
    60_000,
  );
  const parsed = JSON.parse(res.body || '{}') as {
    choices?: { message?: { tool_calls?: unknown[] } }[];
    usage?: unknown;
  };
  return {
    status: res.status,
    latencyMs: res.latencyMs,
    toolCallReturned: (parsed.choices?.[0]?.message?.tool_calls?.length ?? 0) > 0,
    usage: parsed.usage,
    bodyPreview: res.status === 200 ? undefined : res.body.slice(0, 300),
  };
});

await step('sam.responses_api', async () => {
  const res = await timedFetch(
    `${base}/responses`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        model: samModel,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'rectangle' },
              { type: 'input_image', image_url: `data:image/png;base64,${samplePng()}` },
            ],
          },
        ],
      }),
    },
    60_000,
  );
  return {
    status: res.status,
    latencyMs: res.latencyMs,
    containsBoxTokens: res.body.includes('<|box'),
    bodyPreview: res.body.slice(0, 400),
  };
});

await step('vision.chat_with_image', async () => {
  const res = await timedFetch(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe the shapes in this image in one sentence.' },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${samplePng()}` } },
            ],
          },
        ],
        max_tokens: 100,
      }),
    },
    60_000,
  );
  return { status: res.status, latencyMs: res.latencyMs, bodyPreview: res.body.slice(0, 300) };
});

await step('voice.asr_transcribe', async () => {
  const form = new FormData();
  form.append(
    'request',
    new Blob(
      [
        JSON.stringify({
          mode: process.env['META_STT_MODE'] ?? 'ENDPOINTING',
          model: 'muse-voice-transcribe-1.0',
          audioEncoding: 'WAV',
        }),
      ],
      {
        type: 'application/json',
      },
    ),
  );
  form.append('audio', new Blob([new Uint8Array(toneWav())], { type: 'audio/wav' }), 'audio.wav');
  const started = performance.now();
  const res = await fetch(`${base}/asr/transcribe`, {
    method: 'POST',
    headers: auth,
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.text();
  return {
    status: res.status,
    latencyMs: Math.round(performance.now() - started),
    hasTranscriptField: body.includes('"transcript"'),
    bodyPreview: body.slice(0, 300),
  };
});

console.log(`\nEvidence written to ${recorder.save()}`);
console.log('Copy the confirmed facts into docs/api-notes.md before the demo.');
