/**
 * WebSocket probe for protocols that must be learned from the provider docs and observed
 * (Muse Voice Transcribe). It connects, plays a script of steps, and records every message with
 * timestamps relative to the connection.
 *
 *   pnpm smoke:ws path/to/ws-probe.json
 *
 * Probe file: { "name", "url", "headers", "steps", "closeAfterMs" }. Steps are
 *   { "type": "sendText", "text": "..." }
 *   { "type": "sendFile", "path": "...", "chunkBytes": 3200, "intervalMs": 100 }
 *   { "type": "wait", "ms": 500 }
 * Placeholders (${ENV:NAME}, ${FILE_BASE64:path}) are expanded as in smoke:probe.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { expandString, expandValue } from './lib/expand';
import { createRecorder } from './lib/recorder';
import { truncate } from './lib/redact';

const stepSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('sendText'), text: z.string() }),
  z.strictObject({
    type: z.literal('sendFile'),
    path: z.string(),
    chunkBytes: z.number().int().min(1).max(1_000_000),
    intervalMs: z.number().int().min(0).max(10_000),
  }),
  z.strictObject({ type: z.literal('wait'), ms: z.number().int().min(0).max(60_000) }),
]);

const probeSchema = z.strictObject({
  name: z.string().min(1),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).default({}),
  steps: z.array(stepSchema).default([]),
  closeAfterMs: z.number().int().min(100).max(300_000).default(10_000),
});

const file = process.argv[2];
if (file === undefined) {
  console.error('Usage: pnpm smoke:ws path/to/ws-probe.json');
  process.exit(2);
}

const probe = probeSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
const recorder = createRecorder(`ws-${probe.name}`);
const url = expandString(probe.url, process.env);
const headers = expandValue(probe.headers, process.env) as Record<string, string>;
const started = performance.now();
const elapsed = (): number => Math.round(performance.now() - started);
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const socket = new WebSocket(url, { headers });
socket.binaryType = 'arraybuffer';

socket.addEventListener('message', (event: MessageEvent) => {
  const data: unknown = event.data;
  if (typeof data === 'string') {
    recorder.add('received-text', { atMs: elapsed(), text: truncate(data, 2000) });
    console.log(`${String(elapsed()).padStart(6)}ms  <- text ${truncate(data, 160)}`);
  } else if (data instanceof ArrayBuffer) {
    recorder.add('received-binary', { atMs: elapsed(), bytes: data.byteLength });
    console.log(`${String(elapsed()).padStart(6)}ms  <- binary ${String(data.byteLength)} bytes`);
  }
});
socket.addEventListener('error', () => {
  recorder.add('socket-error', { atMs: elapsed() });
  console.log(`${String(elapsed()).padStart(6)}ms  socket error`);
});

const closed = new Promise<void>((resolve) => {
  socket.addEventListener('close', (event: { code: number; reason: string }) => {
    recorder.add('closed', { atMs: elapsed(), code: event.code, reason: event.reason });
    console.log(
      `${String(elapsed()).padStart(6)}ms  closed code=${String(event.code)} reason=${event.reason}`,
    );
    resolve();
  });
});

await new Promise<void>((resolve, reject) => {
  socket.addEventListener('open', () => {
    recorder.add('open', { atMs: elapsed() });
    console.log(`${String(elapsed()).padStart(6)}ms  open`);
    resolve();
  });
  socket.addEventListener('error', () => {
    reject(new Error(`Could not open ${url}.`));
  });
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  recorder.add('connect-failed', { url });
  console.log(`Recording written to ${recorder.save()}`);
  process.exit(1);
});

for (const step of probe.steps) {
  if (step.type === 'sendText') {
    const text = expandString(step.text, process.env);
    socket.send(text);
    recorder.add('sent-text', { atMs: elapsed(), text: truncate(text, 2000) });
    console.log(`${String(elapsed()).padStart(6)}ms  -> text ${truncate(text, 160)}`);
  } else if (step.type === 'sendFile') {
    const content = readFileSync(step.path);
    for (let offset = 0; offset < content.length; offset += step.chunkBytes) {
      socket.send(content.subarray(offset, offset + step.chunkBytes));
      await sleep(step.intervalMs);
    }
    recorder.add('sent-file', {
      atMs: elapsed(),
      path: step.path,
      bytes: content.length,
      chunkBytes: step.chunkBytes,
    });
    console.log(`${String(elapsed()).padStart(6)}ms  -> file ${String(content.length)} bytes`);
  } else {
    await sleep(step.ms);
  }
}

await sleep(probe.closeAfterMs);
socket.close(1000, 'probe finished');
await closed;
console.log(`Recording written to ${recorder.save()}`);
