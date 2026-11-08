import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { StructuredModelPort } from '../application/ports';

export interface ReasoningRoutesOptions {
  readonly modelClient?: StructuredModelPort | undefined;
  readonly provider: string;
  readonly modelId: string;
  readonly baseUrl: string;
}

const smokeResponseSchema = z.object({
  status: z.string(),
});

export function registerReasoningRoutes(
  app: FastifyInstance,
  options: ReasoningRoutesOptions,
): void {
  app.get('/api/reasoning/health', async (request, reply) => {
    const query = request.query as { smoke?: string };
    const doSmoke = query.smoke === 'true' || query.smoke === '1';

    if (!options.modelClient) {
      return reply.code(200).send({
        status: 'rules_only',
        provider: 'deterministic',
        modelId: null,
        message:
          'No language model configured. Hazard analysis and repair use the deterministic rule engine and the trained ML diagnosis model. Optionally point EVON_BASE_URL at a self-hosted Gnani Evon endpoint.',
        timestamp: new Date().toISOString(),
      });
    }

    if (doSmoke) {
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
        return await reply.code(200).send({
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
