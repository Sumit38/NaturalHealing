import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { openDb, transaction, type DatabaseSync } from '../db.js';

/** The application database: accounts, sessions, bugs, scenarios, use cases and test-case suites. One SQLite file. */
export class AppDb {
  readonly db: DatabaseSync;

  constructor(file: string) {
    this.db = openDb(file);
    this.migrate();
  }

  private migrate() {
    const version = (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (version < 1) {
      this.db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'tester',
          disabled INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE sessions (
          token_hash TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );
        CREATE TABLE bugs (
          project TEXT NOT NULL,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY (project, id)
        );
        CREATE TABLE scenarios (
          project TEXT PRIMARY KEY,
          csv TEXT NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE usecases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner INTEGER NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE suites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner INTEGER NOT NULL,
          title TEXT NOT NULL,
          source TEXT NOT NULL,
          usecase_id INTEGER,
          app_url TEXT NOT NULL DEFAULT '',
          cases TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        PRAGMA user_version = 1;
      `);
    }
  }

  meta(key: string): string | undefined {
    return (this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  }
  setMeta(key: string, value: string) {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  /** Imports bugs.json and scenarios.json files left by the earlier file-based storage, once. */
  importLegacy(dataDir: string) {
    if (this.meta('legacy-imported')) return;
    const root = join(dataDir, 'projects');
    if (existsSync(root)) {
      transaction(this.db, () => {
        for (const project of readdirSync(root)) {
          const bugs = join(root, project, 'bugs.json');
          if (existsSync(bugs)) {
            try {
              const old = JSON.parse(readFileSync(bugs, 'utf8')) as { bugs?: { id: string }[] };
              for (const b of old.bugs ?? []) this.db.prepare('INSERT OR IGNORE INTO bugs (project, id, data) VALUES (?, ?, ?)').run(project, b.id, JSON.stringify(b));
            } catch {
              /* skip unreadable file */
            }
          }
          const sc = join(root, project, 'scenarios.json');
          if (existsSync(sc)) {
            try {
              const old = JSON.parse(readFileSync(sc, 'utf8')) as { csv?: string; scenarios?: unknown[] };
              this.db.prepare('INSERT OR IGNORE INTO scenarios (project, csv, json) VALUES (?, ?, ?)').run(project, old.csv ?? '', JSON.stringify(old.scenarios ?? []));
            } catch {
              /* skip unreadable file */
            }
          }
        }
      });
    }
    this.setMeta('legacy-imported', new Date().toISOString());
  }

  // --- scenarios -------------------------------------------------------------
  getScenarios(project: string): { csv: string; scenarios: import('./scenarios.js').Scenario[] } {
    const row = this.db.prepare('SELECT csv, json FROM scenarios WHERE project = ?').get(project) as { csv: string; json: string } | undefined;
    return row ? { csv: row.csv, scenarios: JSON.parse(row.json) } : { csv: '', scenarios: [] };
  }
  setScenarios(project: string, csv: string, scenarios: unknown[]) {
    this.db
      .prepare('INSERT INTO scenarios (project, csv, json) VALUES (?, ?, ?) ON CONFLICT(project) DO UPDATE SET csv = excluded.csv, json = excluded.json')
      .run(project, csv, JSON.stringify(scenarios));
  }
  hasScenarios(project: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM scenarios WHERE project = ?').get(project);
  }
}
