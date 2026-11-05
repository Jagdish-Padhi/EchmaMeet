import { DEFAULT_JWT_SECRET, signJwt } from '../../src/platform/auth';
import type { SqlDatabase } from '../../src/platform/db';

/**
 * Provisions a genuine account row and returns a signed session JWT for it. Integration tests
 * authenticate exactly as production clients do; there is no built-in credential to lean on.
 */
export function provisionTestSession(db: SqlDatabase, userId = 'integration-tester'): string {
  db.run(
    `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, avatar, created_at)
     VALUES (?, ?, 'x', 'Integration Tester', 'Staff SRE', 'IT', ?)`,
    [userId, `${userId}@example.test`, new Date().toISOString()],
  );
  return signJwt(
    { userId, name: 'Integration Tester', role: 'Staff SRE', avatar: 'IT' },
    DEFAULT_JWT_SECRET,
  );
}
