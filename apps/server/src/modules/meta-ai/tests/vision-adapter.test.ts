import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAiVisionAdapter } from '../infrastructure/openai-vision-adapter';
import { ModelCallError } from '../domain/errors';

describe('OpenAiVisionAdapter (Task 7 Vision Reliability)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('correctly parses an architecture diagram with services and connections', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'chat-vis-1',
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  nodes: [
                    {
                      id: 'api-gateway',
                      label: 'API Gateway',
                      kind: 'service',
                      confidence: 0.98,
                      box: { x: 0.1, y: 0.2, width: 0.3, height: 0.2 },
                    },
                    {
                      id: 'user-service',
                      label: 'User Service',
                      kind: 'service',
                      confidence: 0.95,
                      box: { x: 0.5, y: 0.2, width: 0.3, height: 0.2 },
                    },
                  ],
                  edges: [
                    {
                      id: 'edge-gateway-user',
                      sourceLabel: 'API Gateway',
                      targetLabel: 'User Service',
                      confidence: 0.92,
                    },
                  ],
                  ambiguities: [],
                  warnings: [],
                }),
              },
            },
          ],
        }),
    });

    const adapter = new OpenAiVisionAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    });

    const result = await adapter.extractTopologyFromImage('fake-base64-image-bytes', 'image/png');

    expect(result.data.nodes).toHaveLength(2);
    expect(result.data.edges).toHaveLength(1);
    expect(result.data.nodes[0]?.id).toBe('api-gateway');
    expect(result.data.edges[0]?.sourceLabel).toBe('API Gateway');
    expect(result.metadata.provider).toBe('meta_vision');
  });

  it('honestly returns empty nodes and warnings when image is not an architecture diagram', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'chat-vis-2',
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  nodes: [],
                  edges: [],
                  ambiguities: ['No recognizable architecture components detected in the image.'],
                  warnings: ['Image appears to be a landscape photo, not a systems diagram.'],
                }),
              },
            },
          ],
        }),
    });

    const adapter = new OpenAiVisionAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    });

    const result = await adapter.extractTopologyFromImage('fake-cat-photo-bytes', 'image/jpeg');

    expect(result.data.nodes).toHaveLength(0);
    expect(result.data.edges).toHaveLength(0);
    expect(result.data.warnings[0]).toContain('landscape photo');
  });

  it('unwraps markdown json blocks properly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'chat-vis-3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: '```json\n{"nodes":[{"id":"cache-1","label":"Redis Cache","kind":"cache","confidence":0.9}],"edges":[],"ambiguities":[],"warnings":[]}\n```',
              },
            },
          ],
        }),
    });

    const adapter = new OpenAiVisionAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    });

    const result = await adapter.extractTopologyFromImage('fake-bytes', 'image/png');
    expect(result.data.nodes).toHaveLength(1);
    expect(result.data.nodes[0]?.kind).toBe('cache');
  });

  it('throws ModelCallError on HTTP 500 error from vision provider', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Provider GPU Out of Memory'),
    });

    const adapter = new OpenAiVisionAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    });

    await expect(
      adapter.extractTopologyFromImage('fake-bytes', 'image/png'),
    ).rejects.toThrow(ModelCallError);
  });
});
