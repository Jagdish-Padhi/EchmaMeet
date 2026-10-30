import { scenarioSpecSchema, type ScenarioSpec } from '@chaosboard/contracts';

export function parseScenarioSpec(data: unknown): ScenarioSpec {
  return scenarioSpecSchema.parse(data);
}
