import { readFileSync } from 'node:fs';

/**
 * Probe files are templates. These placeholders keep credentials and large files out of the file:
 *   ${ENV:NAME}          the value of an environment variable (an error if it is not set)
 *   ${FILE_TEXT:path}    the UTF-8 content of a file
 *   ${FILE_BASE64:path}  the base64 content of a file
 */
const PLACEHOLDER = /\$\{(ENV|FILE_TEXT|FILE_BASE64):([^}]+)\}/g;

export function expandString(
  template: string,
  env: Readonly<Record<string, string | undefined>>,
): string {
  return template.replace(PLACEHOLDER, (_match, kind: string, argument: string) => {
    if (kind === 'ENV') {
      const value = env[argument];
      if (value === undefined || value === '') {
        throw new Error(`Probe file needs the environment variable ${argument}, which is not set.`);
      }
      return value;
    }
    const content = readFileSync(argument);
    return kind === 'FILE_BASE64' ? content.toString('base64') : content.toString('utf8');
  });
}

export function expandValue(
  value: unknown,
  env: Readonly<Record<string, string | undefined>>,
): unknown {
  if (typeof value === 'string') {
    return expandString(value, env);
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => expandValue(item, env));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, expandValue(inner, env)]),
    );
  }
  return value;
}
