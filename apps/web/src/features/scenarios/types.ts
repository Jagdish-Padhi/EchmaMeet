import type { ScenarioId, ScenarioSpec } from '@chaosboard/contracts';

export interface ScenariosState {
  readonly scenarios: readonly ScenarioSpec[];
  readonly selectedScenarioId: ScenarioId | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}
