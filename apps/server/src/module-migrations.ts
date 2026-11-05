import type { ModuleMigrations } from './platform/migrations';
import { runsMigrations } from './modules/runs';
import { authMigrations } from './platform/auth';
import { roomsMigrations } from './platform/rooms';
import { usageMigrations } from './modules/meta-ai';

/**
 * Migrations of every module that owns tables, in dependency order. A module exports its
 * migrations from its public API and is added here in the phase that introduces its tables.
 */
export const moduleMigrations: readonly ModuleMigrations[] = [
  runsMigrations,
  authMigrations,
  roomsMigrations,
  usageMigrations,
];
