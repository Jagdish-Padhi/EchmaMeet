import { z } from 'zod';

/**
 * RFC 9457 problem details with a stable machine-readable `code` extension.
 * `errors` lists field-level problems for validation failures.
 */
export const problemDetailsSchema = z.strictObject({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  code: z.string().min(1),
  instance: z.string().optional(),
  errors: z.array(z.strictObject({ path: z.string(), message: z.string() })).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
