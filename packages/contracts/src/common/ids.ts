import { z } from 'zod';

const slugPattern = /^[a-z][a-z0-9-]{0,39}$/;
const slugMessage =
  'must start with a lowercase letter and contain only lowercase letters, digits, and hyphens (at most 40 characters)';

export const nodeIdSchema = z.string().regex(slugPattern, slugMessage).brand<'NodeId'>();
export type NodeId = z.infer<typeof nodeIdSchema>;

export const edgeIdSchema = z.string().regex(slugPattern, slugMessage).brand<'EdgeId'>();
export type EdgeId = z.infer<typeof edgeIdSchema>;

export const topologyIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'must be a lowercase slug of at most 64 characters')
  .brand<'TopologyId'>();
export type TopologyId = z.infer<typeof topologyIdSchema>;

export const faultIdSchema = z.string().regex(slugPattern, slugMessage).brand<'FaultId'>();
export type FaultId = z.infer<typeof faultIdSchema>;

export const invariantIdSchema = z.string().regex(slugPattern, slugMessage).brand<'InvariantId'>();
export type InvariantId = z.infer<typeof invariantIdSchema>;

export const runIdSchema = z
  .string()
  .regex(
    /^run-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^run-[a-z0-9-]{8,64}$/,
    'must be a valid run ID (e.g. run-<uuid>)',
  )
  .brand<'RunId'>();
export type RunId = z.infer<typeof runIdSchema>;

export const scenarioIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,63}$/, 'must be a valid scenario slug')
  .brand<'ScenarioId'>();
export type ScenarioId = z.infer<typeof scenarioIdSchema>;
