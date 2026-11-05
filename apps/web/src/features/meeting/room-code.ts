const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 symbols, no look-alikes (l, o, 0, 1)

/**
 * Room codes are capabilities: knowing one is what lets a user ask to join. They are drawn from
 * the platform CSPRNG (never Math.random) with 50 bits of entropy.
 */
export function generateRoomCode(length = 10, prefix = '#rfc-'): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) code += ALPHABET.charAt(byte % ALPHABET.length);
  return `${prefix}${code}`;
}
