import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from 'playwright-core';
import { browserFn } from './browser.js';
import type { Decision, Fingerprint, Snapshot, UINode, Verdict } from './model.js';
import { applyRecords } from './apply.js';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, decide, type Thresholds, type Weights } from './scorer.js';
import { FingerprintStore } from './store.js';

export type HealStatus = 'refused' | 'retried' | 'verified' | 'failed-verification' | 'patched' | 'needs-review';

export interface HealRecord {
  id: string;
  test: string;
  key: string;
  file?: string;
  oldSelector: string;
  newSelector?: string;
  verdict: Verdict;
  confidence: number;
  reason: string;
  oldNode: UINode;
  matched?: UINode;
  status: HealStatus;
  decision: Decision;
  fingerprintAfter?: Fingerprint;
}

export interface HealerOptions {
  storeFile?: string;
  weights?: Weights;
  thresholds?: Thresholds;
  /** Milliseconds to wait for the original locator before treating it as broken. */
  lookupTimeout?: number;
  /** Directory for heal records read by the `heal` command. Defaults to HEAL_DIR or .heal. */
  dir?: string;
}

export class Healer {
  readonly records: HealRecord[] = [];
  private readonly store: FingerprintStore;
  private readonly weights: Weights;
  private readonly thresholds: Thresholds;
  private readonly lookupTimeout: number;
  private test = 'default';
  private readonly recordsFile: string;

  constructor(opts: HealerOptions = {}) {
    const dir = opts.dir ?? process.env.HEAL_DIR ?? '.heal';
    this.recordsFile = join(dir, 'records', `${process.pid}-${Date.now()}.json`);
    this.store = new FingerprintStore(opts.storeFile ?? join(dir, 'fingerprints.json'));
    this.weights = opts.weights ?? DEFAULT_WEIGHTS;
    this.thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
    this.lookupTimeout = opts.lookupTimeout ?? 500;
  }

  beginTest(name: string): void {
    this.test = name;
  }

  /**
   * Drop-in for page.locator(selector). Healing runs only when the lookup
   * finds nothing; assertions are never touched.
   */
  async locate(page: Page, selector: string): Promise<Locator> {
    const file = callerFile();
    const key = `${this.test}::${selector}`;
    const original = page.locator(selector);
    await original.first().waitFor({ state: 'attached', timeout: this.lookupTimeout }).catch(() => undefined);
    const count = await original.count();

    if (count === 1) {
      const node = (await original.elementHandle().then((h) => h && page.evaluate(browserFn as any, h))) as UINode | null;
      if (node) this.store.set(key, { node, viewport: await viewport(page), selector });
      return original;
    }
    const fp = this.store.get(key);
    if (count > 1 || !fp) return original; // nothing to compare against, or strict-mode error for the test to report

    const snap = (await page.evaluate(browserFn as any)) as Snapshot;
    const decision = decide(fp, snap, this.weights, this.thresholds);
    const rec: HealRecord = {
      id: createHash('sha1').update(`${this.test}\0${selector}`).digest('hex').slice(0, 8), test: this.test, key, file, oldSelector: selector, verdict: decision.verdict, confidence: decision.confidence,
      reason: decision.reason, oldNode: fp.node, matched: decision.best?.node, status: 'refused', decision,
    };
    this.records.push(rec);
    this.save();
    if (decision.verdict === 'refuse' || !decision.best) return original;

    const newSelector = await stableSelector(page, decision.best.node);
    if (!newSelector) {
      rec.reason = 'Matched element has no selector that resolves uniquely to it.';
      rec.verdict = 'refuse';
      this.save();
      return original;
    }
    rec.newSelector = newSelector;
    rec.status = 'retried';
    rec.fingerprintAfter = { node: decision.best.node, viewport: snap.viewport, selector: newSelector };
    this.save();
    return page.locator(newSelector);
  }

  /** Called when a test ends. The test passing is the verification of its heals. */
  finish(test: string, passed: boolean): void {
    for (const r of this.records.filter((x) => x.test === test && x.status === 'retried')) {
      r.status = passed ? 'verified' : 'failed-verification';
      if (passed && r.fingerprintAfter) this.store.set(r.key, r.fingerprintAfter);
    }
    this.save();
  }

  private save(): void {
    mkdirSync(join(this.recordsFile, '..'), { recursive: true });
    writeFileSync(this.recordsFile, JSON.stringify(this.records, null, 2));
  }

  /** Writes auto-confidence, verified heals into test source. Others stay suggestions. */
  applyPatches(): HealRecord[] {
    const done = applyRecords(this.records);
    this.save();
    return done;
  }
}

async function viewport(page: Page) {
  return (await page.evaluate('({ w: window.innerWidth, h: window.innerHeight })')) as { w: number; h: number };
}

/** Most stable selector first: test id, role plus name, id, then structure. Each must resolve to exactly the matched element. */
async function stableSelector(page: Page, node: UINode): Promise<string | undefined> {
  const options: string[] = [];
  const tid = node.attrs['data-testid'] ?? node.attrs['data-test'];
  if (tid) options.push(`[data-testid=${JSON.stringify(tid)}]`);
  if (node.role !== 'generic' && node.name) options.push(`role=${node.role}[name=${JSON.stringify(node.name)}s]`);
  if (node.attrs.id && /^[A-Za-z][\w-]*$/.test(node.attrs.id)) options.push(`#${node.attrs.id}`);
  options.push(node.cssPath);
  for (const sel of options) {
    const loc = page.locator(sel);
    if ((await loc.count().catch(() => 0)) !== 1) continue;
    const h = await loc.elementHandle().catch(() => null);
    const found = h ? ((await page.evaluate(browserFn as any, h)) as UINode) : undefined;
    if (found && found.cssPath === node.cssPath) return sel;
  }
  return undefined;
}

function callerFile(): string | undefined {
  const frames = (new Error().stack ?? '').split('\n').slice(1);
  for (const f of frames) {
    const m = f.match(/\(?((?:file:\/\/)?\/[^():]+\.[cm]?[jt]s):\d+:\d+\)?$/);
    if (m && !m[1].endsWith('healer.ts') && !m[1].endsWith('healer.js') && !m[1].includes('node_modules')) {
      return m[1].startsWith('file://') ? fileURLToPath(m[1]) : m[1];
    }
  }
  return undefined;
}
