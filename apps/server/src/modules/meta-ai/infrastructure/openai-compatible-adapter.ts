import { z } from 'zod';
import type {
  ToolCall,
  ToolCapableModelPort,
  ToolChatOptions,
  ToolChatResult,
  ModelCallMetadata,
  StructuredModelCallOptions,
  StructuredModelPort,
  StructuredModelResult,
} from '../application/ports';
import { ModelCallError } from '../domain/errors';

export interface OpenAiAdapterConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly modelId: string;
  readonly chatPath?: string | undefined;
  readonly defaultTimeoutMs?: number | undefined;
  readonly maxTransportRetries?: number | undefined;
  readonly providerName?: string | undefined;
}

const openAiChatResponseSchema = z.looseObject({
  id: z.string().optional(),
  choices: z.array(
    z.looseObject({
      index: z.number().optional(),
      message: z.looseObject({
        role: z.string().optional(),
        content: z.string().nullable().optional(),
      }),
      finish_reason: z.string().nullable().optional(),
    }),
  ),
  usage: z
    .looseObject({
      prompt_tokens: z.number().int().optional(),
      completion_tokens: z.number().int().optional(),
      total_tokens: z.number().int().optional(),
    })
    .optional(),
});

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = jsonBlockRegex.exec(trimmed);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

export class OpenAiCompatibleAdapter implements StructuredModelPort, ToolCapableModelPort {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly endpointUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly maxTransportRetries: number;
  private readonly providerName: string;

  constructor(config: OpenAiAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.modelId = config.modelId;
    const path = config.chatPath ?? '/chat/completions';
    this.endpointUrl = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 60_000;
    this.maxTransportRetries = config.maxTransportRetries ?? 2;
    this.providerName = config.providerName ?? 'spark_open';
  }

  async generateStructured<T>(
    options: StructuredModelCallOptions<T>,
  ): Promise<StructuredModelResult<T>> {
    const promptVersion = options.promptVersion ?? 'v1';
    let currentMessages = [...options.messages];
    let reaskAttempted = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      const { text, usage, latencyMs } = await this.sendChatCompletion(
        currentMessages,
        options.temperature,
        options.maxTokens,
        options.signal,
      );

      if (!text || text.trim().length === 0) {
        throw new ModelCallError('refusal', 'Model returned empty response content.');
      }

      const jsonStr = extractJsonText(text);
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(jsonStr);
      } catch (err) {
        if (!reaskAttempted) {
          reaskAttempted = true;
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: text },
            {
              role: 'user',
              content: `The response was not valid JSON: ${(err as Error).message}. Please reply ONLY with valid JSON.`,
            },
          ];
          continue;
        }
        throw new ModelCallError(
          'malformed_output',
          `Model output could not be parsed as JSON: ${(err as Error).message}`,
          err,
        );
      }

      const validation = options.responseSchema.safeParse(parsedJson);
      if (validation.success) {
        const metadata: ModelCallMetadata = {
          provider: this.providerName,
          modelId: this.modelId,
          promptVersion,
          latencyMs,
          tokenCounts: usage
            ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
              }
            : undefined,
        };

        return {
          data: validation.data,
          rawOutput: text,
          metadata,
        };
      }

      // Schema mismatch
      if (!reaskAttempted) {
        reaskAttempted = true;
        const issuesSummary = validation.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: text },
          {
            role: 'user',
            content: `The JSON response failed schema validation: ${issuesSummary}. Please correct and return valid JSON matching the requested schema.`,
          },
        ];
        continue;
      }

      throw new ModelCallError(
        'schema_mismatch',
        `Model response failed schema validation: ${validation.error.message}`,
        validation.error,
      );
    }

    throw new ModelCallError('malformed_output', 'Exceeded maximum retry attempts.');
  }

  /**
   * One turn of a tool-calling conversation (OpenAI-compatible `tools` / `tool_calls`).
   * The caller owns the loop and the tool execution; this method only performs the model call
   * and normalises its answer. Providers that reject `tools` surface a ModelCallError so the
   * caller can degrade explicitly instead of silently.
   */
  async chatWithTools(options: ToolChatOptions): Promise<ToolChatResult> {
    const { text, message, usage, latencyMs } = await this.sendChatCompletion(
      options.messages,
      options.temperature ?? 0.2,
      options.maxTokens ?? 2048,
      options.signal,
      {
        tools: options.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice: options.toolChoice ?? 'auto',
      },
    );

    const rawCalls = Array.isArray(message['tool_calls'])
      ? (message['tool_calls'] as unknown[])
      : [];
    const toolCalls: ToolCall[] = [];
    for (const raw of rawCalls) {
      const call = raw as { id?: unknown; function?: { name?: unknown; arguments?: unknown } };
      const name = call.function?.name;
      if (typeof name !== 'string') continue;
      let args: unknown = {};
      const rawArgs = call.function?.arguments;
      if (typeof rawArgs === 'string' && rawArgs.trim().length > 0) {
        try {
          args = JSON.parse(rawArgs);
        } catch {
          args = { __unparseable: rawArgs };
        }
      } else if (rawArgs && typeof rawArgs === 'object') {
        args = rawArgs;
      }
      toolCalls.push({
        id: typeof call.id === 'string' ? call.id : `call_${String(toolCalls.length)}`,
        name,
        arguments: args,
      });
    }

    return {
      content: text,
      toolCalls,
      metadata: {
        provider: this.providerName,
        modelId: this.modelId,
        promptVersion: options.promptVersion ?? 'tools-v1',
        latencyMs,
        tokenCounts: usage
          ? { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens }
          : undefined,
      },
    };
  }

  private async sendChatCompletion(
    messages: readonly unknown[],
    temperature = 0.2,
    maxTokens = 2048,
    signal?: AbortSignal,
    extraBody?: Record<string, unknown>,
  ): Promise<{
    text: string | null;
    message: Record<string, unknown>;
    usage?: z.infer<typeof openAiChatResponseSchema>['usage'];
    latencyMs: number;
  }> {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= this.maxTransportRetries) {
      if (signal?.aborted) {
        throw new ModelCallError('timeout', 'Model call aborted by signal.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.defaultTimeoutMs);

      const onParentAbort = () => {
        controller.abort();
      };
      signal?.addEventListener('abort', onParentAbort);

      const startNs = process.hrtime.bigint();
      try {
        const res = await fetch(this.endpointUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.modelId,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...extraBody,
          }),
          signal: controller.signal,
        });

        const elapsedMs = Math.round(Number(process.hrtime.bigint() - startNs) / 1e6);

        if (!res.ok) {
          const status = res.status;
          let bodyText = '';
          try {
            bodyText = await res.text();
          } catch {
            // ignore
          }

          if (status === 408 || status === 504) {
            throw new ModelCallError(
              'timeout',
              `Model request timed out with HTTP ${String(status)}`,
            );
          }
          if (status === 429 || (status >= 500 && status <= 599)) {
            throw new ModelCallError(
              'transport_error',
              `Model provider temporary error (${String(status)}): ${bodyText}`,
            );
          }
          if (status === 400 || status === 422) {
            throw new ModelCallError(
              'malformed_output',
              `Bad request to model provider (${String(status)}): ${bodyText}`,
            );
          }
          throw new ModelCallError(
            'transport_error',
            `HTTP error ${String(status)} from model provider: ${bodyText}`,
          );
        }

        const rawJson: unknown = await res.json();
        const parsed = openAiChatResponseSchema.parse(rawJson);
        const choice = parsed.choices[0];
        const text = choice?.message.content ?? null;

        return {
          text,
          message: choice?.message ?? {},
          usage: parsed.usage,
          latencyMs: elapsedMs,
        };
      } catch (err) {
        lastError = err;
        if (err instanceof ModelCallError && err.errorClass === 'timeout') {
          throw err;
        }

        const isNetworkOr5xx =
          err instanceof ModelCallError && err.errorClass === 'transport_error';
        const isAbort =
          err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));

        if (isAbort && !signal?.aborted) {
          throw new ModelCallError(
            'timeout',
            `Model request exceeded deadline of ${String(this.defaultTimeoutMs)}ms`,
          );
        }

        if (attempt < this.maxTransportRetries && isNetworkOr5xx) {
          attempt += 1;
          const backoffMs = Math.min(2000, 200 * Math.pow(2, attempt) + Math.random() * 100);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        if (err instanceof ModelCallError) {
          throw err;
        }
        throw new ModelCallError(
          'transport_error',
          `Network failure reaching model provider: ${(err as Error).message}`,
          err,
        );
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onParentAbort);
      }
    }

    throw new ModelCallError(
      'transport_error',
      `Exhausted retries reaching model provider: ${(lastError as Error).message}`,
      lastError,
    );
  }
}
