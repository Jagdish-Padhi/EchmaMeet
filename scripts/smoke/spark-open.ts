/**
 * Phase 0 smoke test: Spark Open on a partner host.
 *
 * The request shapes below follow the OpenAI-compatible chat completions convention, which the
 * hackathon guide says the Baseten endpoint exposes. They are HYPOTHESES to test, not facts. This
 * script records what the real server did with each one so docs/api-notes.md can state it. A
 * rejected request is a useful result, not a script failure.
 *
 * Environment: PARTNER_BASE_URL, PARTNER_API_KEY, PARTNER_MODEL_ID. Optional: PARTNER_CHAT_PATH
 * (default /chat/completions), SMOKE_IMAGE_PATH, SMOKE_STRUCTURED_ATTEMPTS (default 10).
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { median, timedFetch, type TimedResponse } from './lib/http';
import { createRecorder } from './lib/recorder';

const env = z
  .object({
    PARTNER_BASE_URL: z.url(),
    PARTNER_API_KEY: z.string().min(1),
    PARTNER_MODEL_ID: z.string().min(1),
    PARTNER_CHAT_PATH: z.string().default('/chat/completions'),
    SMOKE_IMAGE_PATH: z.string().optional(),
    SMOKE_STRUCTURED_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(10),
  })
  .parse(process.env);

const recorder = createRecorder('spark-open');
const url = `${env.PARTNER_BASE_URL.replace(/\/$/, '')}${env.PARTNER_CHAT_PATH}`;
const REQUEST_TIMEOUT_MS = 120_000;

async function chat(body: Record<string, unknown>): Promise<TimedResponse> {
  return timedFetch(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.PARTNER_API_KEY}`,
      },
      body: JSON.stringify({ model: env.PARTNER_MODEL_ID, ...body }),
    },
    REQUEST_TIMEOUT_MS,
  );
}

function summarize(
  step: string,
  response: TimedResponse,
  extra: Record<string, unknown> = {},
): void {
  recorder.add(step, {
    status: response.status,
    latencyMs: response.latencyMs,
    rateLimitHeaders: recorder.redactor.headers(response.rateLimitHeaders),
    body: response.body,
    ...extra,
  });
  console.log(
    `${step.padEnd(22)} status=${String(response.status)} latency=${String(response.latencyMs)}ms`,
  );
}

function firstMessage(body: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    const choices = (parsed as { choices?: { message?: Record<string, unknown> }[] }).choices;
    return choices?.[0]?.message;
  } catch {
    return undefined;
  }
}

async function plainText(): Promise<void> {
  const latencies: number[] = [];
  for (let run = 0; run < 3; run += 1) {
    const response = await chat({
      messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
      max_tokens: 64,
    });
    latencies.push(response.latencyMs);
    if (run === 0) {
      summarize('text', response);
    }
  }
  recorder.add('text-latency', { runs: latencies.length, medianMs: median(latencies), latencies });
}

const answerSchema = z.object({ city: z.string(), population_millions: z.number() });

async function structuredOutput(): Promise<void> {
  let wellFormed = 0;
  let matchedSchema = 0;
  let rejected = 0;
  let lastStatus = 0;
  for (let attempt = 0; attempt < env.SMOKE_STRUCTURED_ATTEMPTS; attempt += 1) {
    const response = await chat({
      messages: [
        {
          role: 'user',
          content: 'Give one large city and its approximate population in millions as JSON.',
        },
      ],
      max_tokens: 200,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'city_probe',
          strict: true,
          schema: {
            type: 'object',
            properties: { city: { type: 'string' }, population_millions: { type: 'number' } },
            required: ['city', 'population_millions'],
            additionalProperties: false,
          },
        },
      },
    });
    lastStatus = response.status;
    if (attempt === 0) {
      summarize('structured-first', response);
    }
    if (response.status >= 400) {
      rejected += 1;
      continue;
    }
    const content = firstMessage(response.body)?.['content'];
    if (typeof content !== 'string') {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(content);
      wellFormed += 1;
      if (answerSchema.safeParse(parsed).success) {
        matchedSchema += 1;
      }
    } catch {
      // counted as not well formed
    }
  }
  recorder.add('structured-summary', {
    attempts: env.SMOKE_STRUCTURED_ATTEMPTS,
    rejectedByServer: rejected,
    wellFormedJson: wellFormed,
    matchedSchema,
    lastStatus,
    note: 'A response_format the server rejects or ignores shows up as rejectedByServer or low matchedSchema.',
  });
  console.log(
    `structured             ${String(matchedSchema)}/${String(env.SMOKE_STRUCTURED_ATTEMPTS)} matched the schema, ${String(rejected)} rejected`,
  );
}

async function toolCall(): Promise<void> {
  const tools = [
    {
      type: 'function',
      function: {
        name: 'lookup_value',
        description: 'Looks up the stored value for a key.',
        parameters: {
          type: 'object',
          properties: { key: { type: 'string' } },
          required: ['key'],
        },
      },
    },
  ];
  const first = await chat({
    messages: [
      { role: 'user', content: 'What is the stored value for the key "alpha"? Use the tool.' },
    ],
    tools,
    tool_choice: 'auto',
    max_tokens: 200,
  });
  const message = firstMessage(first.body);
  const toolCalls = message?.['tool_calls'];
  summarize('tool-call', first, {
    toolCallReturned: Array.isArray(toolCalls) && toolCalls.length > 0,
  });
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return;
  }
  const call = toolCalls[0] as { id?: string };
  const second = await chat({
    messages: [
      { role: 'user', content: 'What is the stored value for the key "alpha"? Use the tool.' },
      message,
      { role: 'tool', tool_call_id: call.id ?? 'unknown', content: '42' },
    ],
    tools,
    max_tokens: 200,
  });
  summarize('tool-roundtrip', second);
}

async function imageInput(): Promise<void> {
  if (env.SMOKE_IMAGE_PATH === undefined) {
    recorder.add('image', {
      skipped: 'SMOKE_IMAGE_PATH is not set, so image input was not tested.',
    });
    console.log('image                  SKIPPED (set SMOKE_IMAGE_PATH to a diagram photo)');
    return;
  }
  const base64 = readFileSync(env.SMOKE_IMAGE_PATH).toString('base64');
  const extension = env.SMOKE_IMAGE_PATH.split('.').pop()?.toLowerCase() ?? 'png';
  const mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`;
  const response = await chat({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'List the boxes and arrows you can see in this diagram.' },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
    max_tokens: 500,
  });
  summarize('image', response, { imageBytes: Math.round((base64.length * 3) / 4) });
}

async function main(): Promise<void> {
  console.log(`Target: ${url}  model: ${env.PARTNER_MODEL_ID}`);
  recorder.add('target', { url, model: env.PARTNER_MODEL_ID });
  const steps: [string, () => Promise<void>][] = [
    ['text', plainText],
    ['structured output', structuredOutput],
    ['tool calling', toolCall],
    ['image input', imageInput],
  ];
  for (const [name, run] of steps) {
    try {
      await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recorder.add(`${name}-error`, { message });
      console.log(`${name.padEnd(22)} ERROR ${message}`);
    }
  }
  recorder.add('not-probed', {
    reasoningLevels:
      'The parameter that selects reasoning effort is unknown, so it was not guessed. Find it in the provider docs and probe it with `pnpm smoke:probe`.',
  });
  console.log(`Recording written to ${recorder.save()}`);
}

await main();
