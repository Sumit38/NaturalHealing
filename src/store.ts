import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb, retryBusy, transaction, type DatabaseSync } from './db.js';
import type { Fingerprint } from './model.js';

/**
 * Fingerprints saved on every green lookup. A `.db` path uses SQLite, which is safe when several test
 * workers write at once; any other path is a JSON file (single process only). A `.db` store imports a
 * `fingerprints.json` sitting next to it the first time it is opened.
 */
export class FingerprintStore {
  private data: Record<string, Fingerprint> = {};
  private db?: DatabaseSync;

  constructor(private readonly file: string) {
    if (file.endsWith('.db')) {
      this.db = openDb(file);
      const db = this.db;
      retryBusy(() => db.exec('CREATE TABLE IF NOT EXISTS fingerprints (key TEXT PRIMARY KEY, json TEXT NOT NULL)'));
      const legacy = file.replace(/\.db$/, '.json');
      const empty = (retryBusy(() => db.prepare('SELECT COUNT(*) AS n FROM fingerprints').get()) as { n: number }).n === 0;
      if (empty && existsSync(legacy)) {
        try {
          const old = JSON.parse(readFileSync(legacy, 'utf8')) as Record<string, Fingerprint>;
          for (const [k, v] of Object.entries(old)) this.set(k, v);
        } catch {
          /* an unreadable old file is skipped */
        }
      }
    } else if (existsSync(file)) {
      this.data = JSON.parse(readFileSync(file, 'utf8'));
    }
  }

  get(key: string): Fingerprint | undefined {
    if (this.db) {
      const row = this.db.prepare('SELECT json FROM fingerprints WHERE key = ?').get(key) as { json: string } | undefined;
      return row ? (JSON.parse(row.json) as Fingerprint) : undefined;
    }
    return this.data[key];
  }

  set(key: string, fp: Fingerprint): void {
    if (this.db) {
      const db = this.db;
      transaction(db, () => db.prepare('INSERT INTO fingerprints (key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json').run(key, JSON.stringify(fp)));
      return;
    }
    this.data[key] = fp;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  count(): number {
    return this.db ? (this.db.prepare('SELECT COUNT(*) AS n FROM fingerprints').get() as { n: number }).n : Object.keys(this.data).length;
  }
}
