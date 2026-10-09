import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type { DatabaseSync };

/**
 * Opens a SQLite file (or ':memory:'). WAL mode and a busy timeout let several processes, such as the
 * parallel workers of a test runner, write to the same file without overwriting each other.
 */
export function openDb(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout = 8000');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL');
  return db;
}

/** Runs `fn` in one transaction; takes the write lock first so two writers cannot interleave. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
