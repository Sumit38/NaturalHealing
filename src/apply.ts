import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HealRecord } from './healer.js';
import { patchSelector } from './patcher.js';

export interface ApplyOptions {
  /** Record ids a human approved even though confidence was below the auto level. */
  approve?: string[];
  /** Apply only records at or above this confidence (defaults to each record's own verdict). */
  minConfidence?: number;
}

/** Rewrites test source for verified heals: auto-level ones, plus any a human approved by id. */
export function applyRecords(records: HealRecord[], opts: ApplyOptions = {}): HealRecord[] {
  const done: HealRecord[] = [];
  for (const r of records) {
    const approved = opts.approve?.includes(r.id) ?? false;
    const eligible = r.verdict === 'auto' || approved || (opts.minConfidence !== undefined && r.confidence >= opts.minConfidence);
    if (r.status !== 'verified' || !eligible || !r.file || !r.newSelector) continue;
    const res = patchSelector(r.file, r.oldSelector, r.newSelector);
    r.status = res.applied ? 'patched' : 'needs-review';
    if (!res.applied) r.reason = res.reason;
    done.push(r);
  }
  return done;
}

/** Reads every record file written by Healer instances (one per test process). */
export function loadRecords(dir: string): HealRecord[] {
  const recordsDir = join(dir, 'records');
  let files: string[] = [];
  try {
    files = readdirSync(recordsDir).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  return files.flatMap((f) => JSON.parse(readFileSync(join(recordsDir, f), 'utf8')) as HealRecord[]);
}

/** Applies heals across every record file in `dir` and saves the new statuses back. */
export function applyInDir(dir: string, opts: ApplyOptions = {}): HealRecord[] {
  const recordsDir = join(dir, 'records');
  const changed: HealRecord[] = [];
  let files: string[] = [];
  try {
    files = readdirSync(recordsDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  for (const f of files) {
    const path = join(recordsDir, f);
    const records = JSON.parse(readFileSync(path, 'utf8')) as HealRecord[];
    const done = applyRecords(records, opts);
    if (done.length) writeFileSync(path, JSON.stringify(records, null, 2));
    changed.push(...done);
  }
  return changed;
}
