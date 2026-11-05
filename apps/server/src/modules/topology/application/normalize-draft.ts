import {
  topologyDraftSchema,
  type NormalizationNote,
  type Topology,
  type TopologyProblem,
} from '@chaosboard/contracts';
import { err, ok, type Result } from '@chaosboard/shared';
import { buildTopologyFromDraft } from '../domain/normalize';
import { schemaProblems } from './schema-problems';
import { validateTopologyInput } from './validate-topology';

export interface NormalizedTopology {
  readonly topology: Topology;
  readonly notes: readonly NormalizationNote[];
}

/** Draft in, validated topology and a full list of what was changed out. */
export function normalizeTopologyDraft(
  input: unknown,
): Result<NormalizedTopology, TopologyProblem[]> {
  const parsedDraft = topologyDraftSchema.safeParse(input);
  if (!parsedDraft.success) {
    return err(schemaProblems(parsedDraft.error, 'draft'));
  }
  const built = buildTopologyFromDraft(parsedDraft.data);
  if (!built.ok) {
    return built;
  }
  const validated = validateTopologyInput(built.value.topology);
  if (!validated.valid) {
    return err(validated.problems);
  }
  return ok({ topology: validated.topology, notes: built.value.notes });
}
