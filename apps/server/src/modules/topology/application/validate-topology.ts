import {
  topologyDraftSchema,
  topologySchema,
  type ValidateTopologyResponse,
} from '@chaosboard/contracts';
import { buildTopologyFromDraft } from '../domain/normalize';
import { findTopologyProblems } from '../domain/validate';
import { schemaProblems } from './schema-problems';

/**
 * Validates an untrusted topology: first the schema (shapes, bounds, kinds), then the semantic
 * graph rules. Graph rules only run on schema-valid input because they depend on its shape, so
 * a topology with schema violations reports those first.
 * If a TopologyDraft is provided (e.g. from canvas or visual drafting), it is normalized first.
 */
export function validateTopologyInput(input: unknown): ValidateTopologyResponse {
  const parsed = topologySchema.safeParse(input);
  if (parsed.success) {
    const problems = findTopologyProblems(parsed.data);
    if (problems.length > 0) {
      return { valid: false, problems };
    }
    return { valid: true, topology: parsed.data };
  }

  // Graceful fallback: check if input is a TopologyDraft
  const parsedDraft = topologyDraftSchema.safeParse(input);
  if (parsedDraft.success) {
    const built = buildTopologyFromDraft(parsedDraft.data);
    if (!built.ok) {
      return { valid: false, problems: built.error };
    }
    const problems = findTopologyProblems(built.value.topology);
    if (problems.length > 0) {
      return { valid: false, problems };
    }
    return { valid: true, topology: built.value.topology };
  }

  return { valid: false, problems: schemaProblems(parsed.error, 'topology') };
}
