import type { BenchmarkSuiteSummary } from '@chaosboard/contracts';

export interface BenchmarksState {
  readonly summary: BenchmarkSuiteSummary | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}
