import { z } from 'zod';
import { scenarioIdSchema } from '../common/ids';
import { topologySchema } from '../topology/topology';
import { faultSchema } from './fault';
import { invariantSchema } from './invariant';
import { trialConfigSchema } from '../execution/trial';

export const expectedOutcomeSchema = z.enum(['PASS', 'VIOLATED', 'TRADE_OFF']);
export type ExpectedOutcome = z.infer<typeof expectedOutcomeSchema>;

export const scenarioSpecSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: scenarioIdSchema,
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  designedFailureMode: z.string().min(1),
  expectedOutcome: expectedOutcomeSchema,
  topology: topologySchema,
  faults: z.array(faultSchema),
  invariants: z.array(invariantSchema),
  trialConfig: trialConfigSchema,
});

export type ScenarioSpec = z.infer<typeof scenarioSpecSchema>;
