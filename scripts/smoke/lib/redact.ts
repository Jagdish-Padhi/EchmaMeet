const SECRET_NAME = /(key|token|secret|password|authorization)/i;
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'cookie',
  'set-cookie',
]);

/** Values of environment variables whose names look like credentials. */
export function collectSecrets(env: Readonly<Record<string, string | undefined>>): string[] {
  return Object.entries(env)
    .filter(([name, value]) => SECRET_NAME.test(name) && value !== undefined && value.length >= 8)
    .map(([, value]) => value as string);
}

/** Removes known secret values from any string, and sensitive header values from header maps. */
export function createRedactor(secrets: readonly string[]): {
  text(value: string): string;
  headers(headers: Readonly<Record<string, string>>): Record<string, string>;
} {
  const text = (value: string): string => {
    let result = value;
    for (const secret of secrets) {
      result = result.split(secret).join('[redacted]');
    }
    return result;
  };
  return {
    text,
    headers(headers) {
      return Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [
          name,
          SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[redacted]' : text(value),
        ]),
      );
    },
  };
}

/** Shortens long strings (for example base64 images) so recordings stay readable. */
export function truncate(value: string, maxChars: number): string {
  return value.length <= maxChars
    ? value
    : `${value.slice(0, maxChars)}... [truncated ${String(value.length - maxChars)} characters]`;
}
