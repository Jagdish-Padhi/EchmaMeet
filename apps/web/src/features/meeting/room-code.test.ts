import { describe, expect, it } from 'vitest';
import { generateRoomCode } from './room-code';

describe('generateRoomCode', () => {
  it('gives every solo session its own private room', () => {
    const a = generateRoomCode(10, '#solo-');
    expect(a).toMatch(/^#solo-[a-z2-9]{10}$/);
    expect(a).not.toBe(generateRoomCode(10, '#solo-'));
  });

  it('matches the server room-id pattern and is unique across many draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      const code = generateRoomCode();
      expect(code).toMatch(/^#rfc-[a-z2-9]{10}$/);
      expect(/^[#a-zA-Z0-9_\-.]{1,64}$/.test(code)).toBe(true);
      seen.add(code);
    }
    expect(seen.size).toBe(5000);
  });
});
