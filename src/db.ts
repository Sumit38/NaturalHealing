import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type { DatabaseSync };

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Runs a database statement, trying again for a few seconds if another process holds the lock. SQLite's own
 * busy timeout does not cover every command: switching a brand-new file to WAL mode fails at once when several
 * processes do it together, which is what several test workers starting on a new project do.
 */
export function retryBusy<T>(fn: () => T): T {
  for (let attempt = 0; ; attempt++) {
    try {
      return fn();
    } catch (e) {
      if (attempt >= 80 || !/locked|busy/i.test(String((e as Error).message))) throw e;
      pause(20 + Math.random() * 60);
    }
  }
}

/**
 * Opens a SQLite file (or ':memory:'). WAL mode and a busy timeout let several processes, such as the
 * parallel workers of a test runner, write to the same file without overwriting each other.
 */
export function openDb(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout = 8000');
  if (file !== ':memory:') retryBusy(() => db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL'));
  return db;
}

/** Runs `fn` in one transaction; takes the write lock first so two writers cannot interleave. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  retryBusy(() => db.exec('BEGIN IMMEDIATE'));
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
