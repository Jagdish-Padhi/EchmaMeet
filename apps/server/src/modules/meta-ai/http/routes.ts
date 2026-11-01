import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { StructuredModelPort } from '../application/ports';

export interface MetaAiRoutesOptions {
  readonly modelClient?: StructuredModelPort | undefined;
  readonly provider: string;
  readonly modelId: string;
  readonly baseUrl: string;
  readonly hasApiKey: boolean;
}

const smokeResponseSchema = z.object({
  status: z.string(),
});

export function registerMetaAiRoutes(
  app: FastifyInstance,
  options: MetaAiRoutesOptions,
): void {
  app.get('/api/meta-ai/health', async (request, reply) => {
    const query = request.query as { smoke?: string };
    const doSmoke = query?.smoke === 'true' || query?.smoke === '1';

    if (!options.hasApiKey) {
      return reply.code(200).send({
        status: 'unconfigured',
        provider: options.provider,
        modelId: options.modelId,
        message: 'No API key configured for AI provider. Set PARTNER_API_KEY or GROQ_API_KEY.',
        timestamp: new Date().toISOString(),
      });
    }

    if (doSmoke && options.modelClient) {
      try {
        const startNs = process.hrtime.bigint();
        const res = await options.modelClient.generateStructured({
          messages: [
            {
              role: 'user',
              content: 'Return a JSON object with {"status": "ok"}. Do not return any other text.',
            },
          ],
          responseSchema: smokeResponseSchema,
          maxTokens: 50,
        });
        const latencyMs = Math.round(Number(process.hrtime.bigint() - startNs) / 1e6);
        return reply.code(200).send({
          status: 'healthy',
          provider: options.provider,
          modelId: options.modelId,
          smoke: {
            success: true,
            latencyMs,
            result: res.data,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return reply.code(200).send({
          status: 'degraded',
          provider: options.provider,
          modelId: options.modelId,
          smoke: {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return reply.code(200).send({
      status: 'configured',
      provider: options.provider,
      modelId: options.modelId,
      baseUrl: options.baseUrl,
      timestamp: new Date().toISOString(),
    });
  });
}
