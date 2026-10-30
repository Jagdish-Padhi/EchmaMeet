/**
 * Phase 0 smoke test: Toxiproxy.
 *
 * Starts a local TCP echo server, puts a Toxiproxy proxy in front of it, and applies each toxic
 * type this project might use, measuring what a client actually experiences. The toxic names and
 * attributes below are HYPOTHESES taken from memory of the Toxiproxy README. The server decides:
 * a toxic it rejects shows up as rejected, and the measured behavior (not the name) is what
 * docs/api-notes.md should record.
 *
 * Environment: TOXIPROXY_URL. Optional:
 *   TOXIPROXY_PROXY_LISTEN   address Toxiproxy binds for the proxy (default 127.0.0.1:0)
 *   TOXIPROXY_CLIENT_HOST    host the client uses to reach that proxy port (default 127.0.0.1)
 *   TOXIPROXY_UPSTREAM_HOST  host Toxiproxy uses to reach the echo server (default 127.0.0.1)
 *   SMOKE_ECHO_BIND          address the echo server binds (default 127.0.0.1)
 * When Toxiproxy runs in Docker, set the last three so the container and the host can see each
 * other, and publish the proxy port.
 */
import { createServer, connect, type Server } from 'node:net';
import { z } from 'zod';
import { median, timedFetch } from './lib/http';
import { createRecorder } from './lib/recorder';

const env = z
  .object({
    TOXIPROXY_URL: z.url(),
    TOXIPROXY_PROXY_LISTEN: z.string().default('127.0.0.1:0'),
    TOXIPROXY_CLIENT_HOST: z.string().default('127.0.0.1'),
    TOXIPROXY_UPSTREAM_HOST: z.string().default('127.0.0.1'),
    SMOKE_ECHO_BIND: z.string().default('127.0.0.1'),
  })
  .parse(process.env);

const recorder = createRecorder('toxiproxy');
const api = env.TOXIPROXY_URL.replace(/\/$/, '');
const PROXY_NAME = 'chaosboard-smoke-echo';
const WINDOW_MS = 2500;

interface EchoOutcome {
  outcome:
    | 'echoed'
    | 'partial'
    | 'no_data_before_window'
    | 'closed_without_data'
    | 'reset'
    | 'connect_error';
  bytesReceived: number;
  dataChunks: number;
  firstByteMs: number | null;
  lastByteMs: number | null;
  closeAfterEndMs: number | null;
  totalMs: number;
  error: string | null;
}

function probeEcho(port: number, payload: Buffer, endAfterEcho = false): Promise<EchoOutcome> {
  return new Promise((resolve) => {
    const started = performance.now();
    const elapsed = (): number => Math.round(performance.now() - started);
    const result: EchoOutcome = {
      outcome: 'no_data_before_window',
      bytesReceived: 0,
      dataChunks: 0,
      firstByteMs: null,
      lastByteMs: null,
      closeAfterEndMs: null,
      totalMs: 0,
      error: null,
    };
    let endedAt: number | null = null;
    let settled = false;
    const socket = connect({ host: env.TOXIPROXY_CLIENT_HOST, port });

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      result.totalMs = elapsed();
      if (result.error?.includes('ECONNREFUSED') === true) {
        result.outcome = 'connect_error';
      } else if (result.error?.includes('ECONNRESET') === true) {
        result.outcome = 'reset';
      } else if (result.bytesReceived >= payload.length) {
        result.outcome = 'echoed';
      } else if (result.bytesReceived > 0) {
        result.outcome = 'partial';
      } else if (result.closeAfterEndMs !== null || result.error === null) {
        result.outcome =
          result.totalMs >= WINDOW_MS ? 'no_data_before_window' : 'closed_without_data';
      }
      resolve(result);
    };
    const timer = setTimeout(finish, WINDOW_MS);

    socket.on('connect', () => {
      socket.write(payload);
    });
    socket.on('data', (chunk: Buffer) => {
      result.bytesReceived += chunk.length;
      result.dataChunks += 1;
      result.firstByteMs ??= elapsed();
      result.lastByteMs = elapsed();
      if (endAfterEcho && result.bytesReceived >= payload.length && endedAt === null) {
        endedAt = elapsed();
        socket.end();
      }
    });
    socket.on('error', (error: Error) => {
      result.error = error.message;
    });
    socket.on('close', () => {
      if (endedAt !== null) {
        result.closeAfterEndMs = elapsed() - endedAt;
      }
      finish();
    });
  });
}

async function control(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: string }> {
  const response = await timedFetch(
    `${api}${path}`,
    {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    10_000,
  );
  return { status: response.status, body: response.body };
}

interface ToxicCase {
  readonly label: string;
  readonly type: string;
  readonly stream: 'upstream' | 'downstream';
  readonly attributes: Record<string, unknown>;
  readonly payload?: Buffer;
  readonly endAfterEcho?: boolean;
}

const smallPayload = Buffer.from('ping\n');
const longPayload = Buffer.from('ping-ping-ping-ping-ping-ping-ping-ping\n');
const bigPayload = Buffer.alloc(3 * 1024, 'x');

const cases: readonly ToxicCase[] = [
  {
    label: 'latency 300ms downstream',
    type: 'latency',
    stream: 'downstream',
    attributes: { latency: 300, jitter: 0 },
  },
  {
    label: 'latency 300ms upstream',
    type: 'latency',
    stream: 'upstream',
    attributes: { latency: 300, jitter: 0 },
  },
  {
    label: 'latency 300ms jitter 200',
    type: 'latency',
    stream: 'downstream',
    attributes: { latency: 300, jitter: 200 },
  },
  {
    label: 'bandwidth rate 1 (3KB payload)',
    type: 'bandwidth',
    stream: 'downstream',
    attributes: { rate: 1 },
    payload: bigPayload,
  },
  {
    label: 'slow_close delay 600ms',
    type: 'slow_close',
    stream: 'downstream',
    attributes: { delay: 600 },
    endAfterEcho: true,
  },
  { label: 'timeout 500ms', type: 'timeout', stream: 'downstream', attributes: { timeout: 500 } },
  { label: 'timeout 0', type: 'timeout', stream: 'downstream', attributes: { timeout: 0 } },
  {
    label: 'slicer 1 byte, 20ms delay',
    type: 'slicer',
    stream: 'downstream',
    attributes: { average_size: 1, size_variation: 0, delay: 20000 },
    payload: longPayload,
  },
  {
    label: 'limit_data 10 bytes',
    type: 'limit_data',
    stream: 'downstream',
    attributes: { bytes: 10 },
    payload: longPayload,
  },
  {
    label: 'reset_peer timeout 100ms',
    type: 'reset_peer',
    stream: 'downstream',
    attributes: { timeout: 100 },
  },
];

async function main(): Promise<void> {
  const version = await control('GET', '/version');
  recorder.add('version', version);
  console.log(`Toxiproxy ${version.body.trim()} at ${api}`);

  const echo: Server = createServer((socket) => {
    socket.on('data', (chunk: Buffer) => {
      socket.write(chunk);
    });
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => {
    echo.listen(0, env.SMOKE_ECHO_BIND, resolve);
  });
  const echoAddress = echo.address();
  if (echoAddress === null || typeof echoAddress === 'string') {
    throw new Error('The echo server did not report a port.');
  }

  try {
    await control('DELETE', `/proxies/${PROXY_NAME}`);
    const created = await control('POST', '/proxies', {
      name: PROXY_NAME,
      listen: env.TOXIPROXY_PROXY_LISTEN,
      upstream: `${env.TOXIPROXY_UPSTREAM_HOST}:${String(echoAddress.port)}`,
      enabled: true,
    });
    recorder.add('create-proxy', created);
    if (created.status >= 400) {
      throw new Error(
        `Creating the proxy failed with status ${String(created.status)}: ${created.body}`,
      );
    }
    const listen = (JSON.parse(created.body) as { listen: string }).listen;
    const proxyPort = Number(listen.slice(listen.lastIndexOf(':') + 1));
    console.log(`Proxy ${PROXY_NAME} listening on ${listen}`);

    const baseline: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const outcome = await probeEcho(proxyPort, smallPayload);
      baseline.push(outcome.firstByteMs ?? -1);
    }
    recorder.add('baseline', { firstByteMs: baseline, medianMs: median(baseline) });
    console.log(`baseline               median first byte ${String(median(baseline))}ms`);

    const accepted: string[] = [];
    for (const toxic of cases) {
      const add = await control('POST', `/proxies/${PROXY_NAME}/toxics`, {
        name: 'smoke-toxic',
        type: toxic.type,
        stream: toxic.stream,
        toxicity: 1,
        attributes: toxic.attributes,
      });
      if (add.status >= 400) {
        recorder.add(toxic.label, {
          type: toxic.type,
          rejected: true,
          status: add.status,
          body: add.body,
        });
        console.log(`${toxic.label.padEnd(32)} REJECTED by server (${String(add.status)})`);
        continue;
      }
      if (!accepted.includes(toxic.type)) {
        accepted.push(toxic.type);
      }
      const outcome = await probeEcho(
        proxyPort,
        toxic.payload ?? smallPayload,
        toxic.endAfterEcho ?? false,
      );
      recorder.add(toxic.label, {
        type: toxic.type,
        attributes: toxic.attributes,
        stream: toxic.stream,
        toxicResponse: add.body,
        measured: outcome,
      });
      console.log(
        `${toxic.label.padEnd(32)} ${outcome.outcome} firstByte=${outcome.firstByteMs === null ? 'none' : `${String(outcome.firstByteMs)}ms`} bytes=${String(outcome.bytesReceived)} chunks=${String(outcome.dataChunks)} total=${String(outcome.totalMs)}ms${outcome.closeAfterEndMs === null ? '' : ` closeAfterEnd=${String(outcome.closeAfterEndMs)}ms`}${outcome.error === null ? '' : ` error=${outcome.error}`}`,
      );
      await control('DELETE', `/proxies/${PROXY_NAME}/toxics/smoke-toxic`);
    }

    // How is toxicity applied: per connection, or otherwise?
    const toxicityAdd = await control('POST', `/proxies/${PROXY_NAME}/toxics`, {
      name: 'smoke-toxicity',
      type: 'latency',
      stream: 'downstream',
      toxicity: 0.5,
      attributes: { latency: 400, jitter: 0 },
    });
    if (toxicityAdd.status < 400) {
      const connections = 30;
      let delayed = 0;
      for (let run = 0; run < connections; run += 1) {
        const outcome = await probeEcho(proxyPort, smallPayload);
        if ((outcome.firstByteMs ?? 0) >= 300) {
          delayed += 1;
        }
      }
      recorder.add('toxicity-0.5-latency-400ms', {
        connections,
        delayedConnections: delayed,
        toxicityResponse: toxicityAdd.body,
      });
      console.log(
        `toxicity 0.5 latency 400ms     ${String(delayed)}/${String(connections)} connections delayed`,
      );
      await control('DELETE', `/proxies/${PROXY_NAME}/toxics/smoke-toxicity`);
    } else {
      recorder.add('toxicity-0.5-latency-400ms', {
        rejected: true,
        status: toxicityAdd.status,
        body: toxicityAdd.body,
      });
    }

    // Taking the proxy down entirely.
    const disabled = await control('POST', `/proxies/${PROXY_NAME}`, { enabled: false });
    const downOutcome = await probeEcho(proxyPort, smallPayload);
    recorder.add('proxy-disabled', {
      updateStatus: disabled.status,
      updateBody: disabled.body,
      measured: downOutcome,
    });
    console.log(
      `proxy disabled                 ${downOutcome.outcome} error=${String(downOutcome.error)}`,
    );
    const enabled = await control('POST', `/proxies/${PROXY_NAME}`, { enabled: true });
    const backOutcome = await probeEcho(proxyPort, smallPayload);
    recorder.add('proxy-reenabled', { updateStatus: enabled.status, measured: backOutcome });
    console.log(`proxy re-enabled               ${backOutcome.outcome}`);

    recorder.add('summary', { acceptedToxicTypes: accepted });
    console.log(`Toxic types the server accepted: ${accepted.join(', ')}`);
  } finally {
    await control('DELETE', `/proxies/${PROXY_NAME}`).catch(() => undefined);
    await new Promise<void>((resolve) => {
      echo.close(() => {
        resolve();
      });
    });
  }
  console.log(`Recording written to ${recorder.save()}`);
}

await main();
