import { topologySchema, type ValidateTopologyResponse } from '@chaosboard/contracts';
import { findTopologyProblems } from '../domain/validate';
import { schemaProblems } from './schema-problems';

/**
 * Validates an untrusted topology: first the schema (shapes, bounds, kinds), then the semantic
 * graph rules. Graph rules only run on schema-valid input because they depend on its shape, so
 * a topology with schema violations reports those first.
 */
export function validateTopologyInput(input: unknown): ValidateTopologyResponse {
  const parsed = topologySchema.safeParse(input);
  if (!parsed.success) {
    return { valid: false, problems: schemaProblems(parsed.error, 'topology') };
  }
  const problems = findTopologyProblems(parsed.data);
  if (problems.length > 0) {
    return { valid: false, problems };
  }
  return { valid: true, topology: parsed.data };
}
