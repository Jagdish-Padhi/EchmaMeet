/**
 * Generic HTTP probe for capabilities whose request shape must come from the provider docs
 * (SAM 3.1, Muse Image, Muse Wonder, any other endpoint). The request lives in a JSON file you
 * write from the docs; this script sends it, times it, and records the real response.
 *
 *   pnpm smoke:probe path/to/probe.json
 *
 * Probe file: { "name", "method", "url", "headers", "body", "repeat", "timeoutMs", "stream" }
 * See docs/smoke-tests.md for the placeholders (${ENV:NAME}, ${FILE_BASE64:path}).
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { expandString, expandValue } from './lib/expand';
import { median, timedFetch } from './lib/http';
import { createRecorder } from './lib/recorder';
import { truncate } from './lib/redact';

const probeSchema = z.strictObject({
  name: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.unknown().optional(),
  repeat: z.number().int().min(1).max(50).default(1),
  timeoutMs: z.number().int().min(1000).max(600_000).default(120_000),
  /** Read the body incrementally and record when each chunk arrived. */
  stream: z.boolean().default(false),
});

const file = process.argv[2];
if (file === undefined) {
  console.error('Usage: pnpm smoke:probe path/to/probe.json');
  process.exit(2);
}

const probe = probeSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
const recorder = createRecorder(`probe-${probe.name}`);
const url = expandString(probe.url, process.env);
const headers = expandValue(probe.headers, process.env) as Record<string, string>;
const body = probe.body === undefined ? undefined : expandValue(probe.body, process.env);
const serializedBody =
  body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);

async function streamOnce(): Promise<Record<string, unknown>> {
  const started = performance.now();
  const response = await fetch(url, {
    method: probe.method,
    headers,
    ...(serializedBody === undefined ? {} : { body: serializedBody }),
    signal: AbortSignal.timeout(probe.timeoutMs),
  });
  const chunks: { atMs: number; bytes: number; preview: string }[] = [];
  const decoder = new TextDecoder();
  if (response.body !== null) {
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      chunks.push({
        atMs: Math.round(performance.now() - started),
        bytes: chunk.byteLength,
        preview: truncate(decoder.decode(chunk, { stream: true }), 300),
      });
    }
  }
  return {
    status: response.status,
    totalMs: Math.round(performance.now() - started),
    firstChunkMs: chunks[0]?.atMs,
    chunkCount: chunks.length,
    chunks: chunks.slice(0, 200),
  };
}

const latencies: number[] = [];
for (let run = 1; run <= probe.repeat; run += 1) {
  try {
    if (probe.stream) {
      const result = await streamOnce();
      latencies.push(Number(result['totalMs']));
      recorder.add(`run-${String(run)}`, result);
      console.log(
        `run ${String(run)} status=${String(result['status'])} total=${String(result['totalMs'])}ms chunks=${String(result['chunkCount'])}`,
      );
    } else {
      const response = await timedFetch(
        url,
        {
          method: probe.method,
          headers,
          ...(serializedBody === undefined ? {} : { body: serializedBody }),
        },
        probe.timeoutMs,
        200_000,
      );
      latencies.push(response.latencyMs);
      recorder.add(`run-${String(run)}`, {
        status: response.status,
        latencyMs: response.latencyMs,
        headers: recorder.redactor.headers(response.headers),
        body: response.body,
      });
      console.log(
        `run ${String(run)} status=${String(response.status)} latency=${String(response.latencyMs)}ms`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recorder.add(`run-${String(run)}-error`, { message });
    console.log(`run ${String(run)} ERROR ${message}`);
  }
}
recorder.add('summary', {
  name: probe.name,
  runs: probe.repeat,
  medianMs: median(latencies),
  latencies,
});
console.log(`Recording written to ${recorder.save()}`);
