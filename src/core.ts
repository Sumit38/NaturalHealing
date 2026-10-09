import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Decision, Fingerprint, Snapshot, UINode, Verdict, Viewport } from './model.js';
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
  /** 'test' when a finished test confirmed the heal; 'step' when only the healed step succeeded. */
  verifiedBy?: 'test' | 'step';
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

/** What a framework adapter gives the engine: a way to look at the page through that framework. */
export interface Probe {
  /** How many elements the selector matches, after waiting up to the lookup timeout for one to appear. */
  count(selector: string): Promise<number>;
  /** Describes the single element the selector matches. */
  describe(selector: string): Promise<UINode | null>;
  /** Every visible element on the page. */
  snapshot(): Promise<Snapshot>;
  viewport(): Promise<Viewport>;
  /** Selectors this framework understands for the node, most stable first. */
  candidates(node: UINode): string[];
}

/** Framework-neutral healing: fingerprints, scoring, records and verification. Adapters supply a Probe. */
export class HealerCore {
  readonly records: HealRecord[] = [];
  private readonly store: FingerprintStore;
  private readonly weights: Weights;
  private readonly thresholds: Thresholds;
  protected readonly lookupTimeout: number;
  protected test = 'default';
  private readonly learned = new Set<string>();
  private readonly recordsFile: string;

  constructor(opts: HealerOptions = {}) {
    const dir = opts.dir ?? process.env.HEAL_DIR ?? '.heal';
    this.recordsFile = join(dir, 'records', `${process.pid}-${Date.now()}.json`);
    this.store = new FingerprintStore(opts.storeFile ?? process.env.HEAL_STORE ?? join(dir, 'fingerprints.db'));
    this.weights = opts.weights ?? DEFAULT_WEIGHTS;
    this.thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
    this.lookupTimeout = opts.lookupTimeout ?? 500;
  }

  beginTest(name: string): void {
    this.test = name;
  }

  /**
   * Returns the selector to use: the original one when it finds exactly one
   * element (its fingerprint is saved), a healed one when it finds nothing
   * and a match is confident enough, else the original so the test fails as usual.
   */
  protected async resolve(probe: Probe, selector: string, file: string | undefined = callerFile()): Promise<string> {
    const key = `${this.test}::${selector}`;
    const count = await probe.count(selector);

    if (count === 1) {
      const node = await probe.describe(selector);
      if (node) this.store.set(key, { node, viewport: await probe.viewport(), selector });
      return selector;
    }
    const fp = this.store.get(key);
    if (count > 1 || !fp) return selector; // nothing to compare against, or an ambiguity for the test to report

    const snap = await probe.snapshot();
    const decision = decide(fp, snap, this.weights, this.thresholds);
    const rec: HealRecord = {
      id: createHash('sha1').update(`${this.test}\0${selector}`).digest('hex').slice(0, 8), test: this.test, key, file, oldSelector: selector, verdict: decision.verdict, confidence: decision.confidence,
      reason: decision.reason, oldNode: fp.node, matched: decision.best?.node, status: 'refused', decision,
    };
    this.records.push(rec);
    this.save();
    if (decision.verdict === 'refuse' || !decision.best) return selector;

    const newSelector = await stableSelector(probe, decision.best.node);
    if (!newSelector) {
      rec.reason = 'Matched element has no selector that resolves uniquely to it.';
      rec.verdict = 'refuse';
      this.save();
      return selector;
    }
    rec.newSelector = newSelector;
    rec.status = 'retried';
    rec.fingerprintAfter = { node: decision.best.node, viewport: snap.viewport, selector: newSelector };
    this.save();
    return newSelector;
  }

  /** Saves a fingerprint for a selector that currently finds exactly one element, once per test. */
  protected async learn(probe: Probe, selector: string): Promise<void> {
    const key = `${this.test}::${selector}`;
    if (this.learned.has(key)) return;
    this.learned.add(key);
    if ((await probe.count(selector)) !== 1) return;
    const node = await probe.describe(selector);
    if (node) this.store.set(key, { node, viewport: await probe.viewport(), selector });
  }

  /** Marks the heal for `newSelector` as verified or failed once the step that used it has finished. */
  protected settle(oldSelector: string, passed: boolean): void {
    const r = this.records.find((x) => x.key === `${this.test}::${oldSelector}` && x.status === 'retried');
    if (!r) return;
    r.status = passed ? 'verified' : 'failed-verification';
    r.verifiedBy = 'step';
    if (passed && r.fingerprintAfter) this.store.set(r.key, r.fingerprintAfter);
    this.save();
  }

  /** Called when a test ends. The test passing is the verification of its heals. */
  finish(test: string, passed: boolean): void {
    for (const r of this.records.filter((x) => x.test === test && x.status === 'retried')) {
      r.status = passed ? 'verified' : 'failed-verification';
      r.verifiedBy = 'test';
      if (passed && r.fingerprintAfter) this.store.set(r.key, r.fingerprintAfter);
    }
    this.save();
  }

  protected save(): void {
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

/** First candidate that resolves to exactly the matched element. */
async function stableSelector(probe: Probe, node: UINode): Promise<string | undefined> {
  for (const sel of probe.candidates(node)) {
    if ((await probe.count(sel).catch(() => 0)) !== 1) continue;
    const found = await probe.describe(sel).catch(() => null);
    if (found && found.cssPath === node.cssPath) return sel;
  }
  return undefined;
}

const OWN_DIR = dirname(fileURLToPath(import.meta.url));

/** The test file that called the healer: the first stack frame outside this package. */
export function callerFile(): string | undefined {
  const frames = (new Error().stack ?? '').split('\n').slice(1);
  const own = norm(OWN_DIR) + '/';
  for (const f of frames) {
    // POSIX (/a/b.ts), Windows (C:\a\b.ts) and file: URLs, with or without parentheses.
    const m = f.match(/\(?((?:file:\/\/\/?)?(?:[A-Za-z]:[\\/]|\/)[^()]*?\.[cm]?[jt]s):\d+:\d+\)?$/);
    if (!m) continue;
    const path = m[1].startsWith('file://') ? fileURLToPath(m[1]) : m[1];
    if (!norm(path).startsWith(own) && !path.includes('node_modules')) return path;
  }
  return undefined;
}

const norm = (p: string) => p.replace(/\\/g, '/');
