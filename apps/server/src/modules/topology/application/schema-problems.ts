import type { TopologyProblem } from '@chaosboard/contracts';
import type { z } from 'zod';

/** Converts schema issues into the closed problem format the API returns. */
export function schemaProblems(error: z.ZodError, subject: string): TopologyProblem[] {
  return error.issues.map((issue) => {
    const path = issue.path.filter(
      (segment): segment is string | number => typeof segment !== 'symbol',
    );
    const location = path.length === 0 ? subject : path.join('.');
    return {
      code: 'schema_violation',
      message: `${location}: ${issue.message}`,
      path,
    };
  });
}
