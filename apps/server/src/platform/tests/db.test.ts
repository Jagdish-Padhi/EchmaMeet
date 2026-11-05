import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { IN_MEMORY, openDatabase, type SqlDatabase } from '../db';

describe('openDatabase', () => {
  const databases: SqlDatabase[] = [];
  const directories: string[] = [];

  function open(path: string): SqlDatabase {
    const database = openDatabase(path);
    databases.push(database);
    return database;
  }

  afterEach(() => {
    for (const database of databases.splice(0)) {
      try {
        database.close();
      } catch {
        // already closed by the test
      }
    }
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('runs statements and reads rows back', () => {
    const database = open(IN_MEMORY);
    database.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    expect(database.run('INSERT INTO items (name) VALUES (?)', ['first']).changes).toBe(1);
    database.run('INSERT INTO items (name) VALUES (?)', ['second']);
    expect(database.get('SELECT name FROM items WHERE id = ?', [2])).toEqual({ name: 'second' });
    expect(database.all('SELECT name FROM items ORDER BY id')).toEqual([
      { name: 'first' },
      { name: 'second' },
    ]);
    expect(database.get('SELECT * FROM items WHERE id = ?', [99])).toBeUndefined();
  });

  it('commits a transaction that returns and rolls back one that throws', () => {
    const database = open(IN_MEMORY);
    database.exec('CREATE TABLE items (name TEXT NOT NULL)');
    database.transaction(() => {
      database.run('INSERT INTO items (name) VALUES (?)', ['kept']);
    });
    expect(() =>
      database.transaction(() => {
        database.run('INSERT INTO items (name) VALUES (?)', ['discarded']);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(database.all('SELECT name FROM items')).toEqual([{ name: 'kept' }]);
  });

  it('refuses nested transactions instead of corrupting state', () => {
    const database = open(IN_MEMORY);
    expect(() => {
      database.transaction(() => {
        database.transaction(() => undefined);
      });
    }).toThrow('Nested transactions');
    database.exec('CREATE TABLE ok (id INTEGER)');
  });

  it('enforces foreign keys', () => {
    const database = open(IN_MEMORY);
    database.exec('CREATE TABLE parent (id INTEGER PRIMARY KEY)');
    database.exec('CREATE TABLE child (parent_id INTEGER REFERENCES parent(id))');
    expect(() => database.run('INSERT INTO child (parent_id) VALUES (?)', [42])).toThrow();
  });

  it('creates missing directories for file databases and persists data', () => {
    const directory = mkdtempSync(join(tmpdir(), 'chaosboard-db-'));
    directories.push(directory);
    const path = join(directory, 'nested', 'data.sqlite');
    const first = open(path);
    first.exec('CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT)');
    first.run('INSERT INTO kv (k, v) VALUES (?, ?)', ['a', '1']);
    first.close();
    const second = open(path);
    expect(second.get('SELECT v FROM kv WHERE k = ?', ['a'])).toEqual({ v: '1' });
  });
});
