import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTopologyResponseSchema } from '@chaosboard/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerTopologyRoutes } from '../http/routes';

const scenarioPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'fixtures',
  'scenarios',
  'retry-storm.json',
);

describe('POST /api/topologies/validate', () => {
  const apps: FastifyInstance[] = [];

  async function createApp(): Promise<FastifyInstance> {
    const app = Fastify();
    registerTopologyRoutes(app);
    await app.ready();
    apps.push(app);
    return app;
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('returns valid true with the topology for a valid scenario', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/topologies/validate',
      headers: { 'content-type': 'application/json' },
      payload: readFileSync(scenarioPath, 'utf8'),
    });
    expect(response.statusCode).toBe(200);
    const body = validateTopologyResponseSchema.parse(response.json());
    expect(body.valid).toBe(true);
  });

  it('returns valid false with problems for an invalid topology', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/topologies/validate',
      payload: { nonsense: true },
    });
    expect(response.statusCode).toBe(200);
    const body = validateTopologyResponseSchema.parse(response.json());
    expect(body.valid).toBe(false);
  });

  it('rejects a malformed JSON body with a client error', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/topologies/validate',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });
    expect(response.statusCode).toBe(400);
  });
});
