import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Fingerprint } from './model.js';

/** Fingerprints saved on every green lookup. A JSON file for the MVP; SQLite later. */
export class FingerprintStore {
  private data: Record<string, Fingerprint> = {};

  constructor(private readonly file: string) {
    if (existsSync(file)) this.data = JSON.parse(readFileSync(file, 'utf8'));
  }

  get(key: string): Fingerprint | undefined {
    return this.data[key];
  }

  set(key: string, fp: Fingerprint): void {
    this.data[key] = fp;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }
}
