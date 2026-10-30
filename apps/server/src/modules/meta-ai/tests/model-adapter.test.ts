import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { OpenAiCompatibleAdapter } from '../infrastructure/openai-compatible-adapter';
import { ModelCallError } from '../domain/errors';

describe('OpenAiCompatibleAdapter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const testSchema = z.strictObject({
    answer: z.string(),
    confidence: z.number().min(0).max(1),
  });

  it('parses valid structured JSON output successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'chat-1',
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({ answer: 'repaired', confidence: 0.95 }),
              },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
    });

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'http://test-provider.local/v1',
      apiKey: 'test-key',
      modelId: 'test-model',
    });

    const result = await adapter.generateStructured({
      messages: [{ role: 'user', content: 'hello' }],
      responseSchema: testSchema,
    });

    expect(result.data.answer).toBe('repaired');
    expect(result.data.confidence).toBe(0.95);
    expect(result.metadata.modelId).toBe('test-model');
    expect(result.metadata.tokenCounts?.promptTokens).toBe(100);
  });

  it('unwraps markdown json fences gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '```json\n{"answer": "fenced", "confidence": 0.8}\n```',
              },
            },
          ],
        }),
    });

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'http://test-provider.local/v1',
      apiKey: 'test-key',
      modelId: 'test-model',
    });

    const result = await adapter.generateStructured({
      messages: [{ role: 'user', content: 'hello' }],
      responseSchema: testSchema,
    });

    expect(result.data.answer).toBe('fenced');
    expect(result.data.confidence).toBe(0.8);
  });

  it('re-asks once on schema mismatch and recovers if model corrects it', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: '{"answer": "bad", "confidence": 999}', // Invalid confidence > 1
                  },
                },
              ],
            }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '{"answer": "corrected", "confidence": 0.99}',
                },
              },
            ],
          }),
      } as unknown as Response);
    });

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'http://test-provider.local/v1',
      apiKey: 'test-key',
      modelId: 'test-model',
    });

    const result = await adapter.generateStructured({
      messages: [{ role: 'user', content: 'hello' }],
      responseSchema: testSchema,
    });

    expect(callCount).toBe(2);
    expect(result.data.answer).toBe('corrected');
    expect(result.data.confidence).toBe(0.99);
  });

  it('throws ModelCallError when provider returns HTTP 500 error after retries', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal server error on GPU worker'),
    });

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'http://test-provider.local/v1',
      apiKey: 'test-key',
      modelId: 'test-model',
      maxTransportRetries: 1,
    });

    await expect(
      adapter.generateStructured({
        messages: [{ role: 'user', content: 'hello' }],
        responseSchema: testSchema,
      }),
    ).rejects.toThrow(ModelCallError);
  });
});
