import type { ModuleMigrations } from './platform/migrations';

/**
 * Migrations of every module that owns tables, in dependency order. A module exports its
 * migrations from its public API and is added here in the phase that introduces its tables.
 */
export const moduleMigrations: readonly ModuleMigrations[] = [];
