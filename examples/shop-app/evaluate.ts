import { readFileSync } from 'node:fs';
import { loadRecords } from '../../src/apply.js';
import type { HealRecord } from '../../src/healer.js';

/**
 * Scores a run against ground truth. Usage:
 *   node --import tsx evaluate.ts <heal dir> <truth log of the baseline run> <truth log of this run> [label]
 * Each lookup is classed by what the healer did and whether the element it
 * resolved to (its data-truth) is the one the test was written for.
 */
const [dir, baselineLog, runLog, label = 'run'] = process.argv.slice(2);
interface Truth { test: string; selector: string; truth: string; got: string | null; targetPresent: boolean; targetVisible: boolean }
const read = (f: string) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Truth);
const baseline = read(baselineLog);
const run = read(runLog);
const records = loadRecords(dir);
const key = (t: { test: string; selector?: string; oldSelector?: string }) => `${t.test}::${t.selector ?? t.oldSelector}`;
const recBy = new Map(records.map((r) => [key(r), r] as const));
const runBy = new Map(run.map((t) => [key(t), t] as const));

type Outcome = 'no heal needed' | 'healed correctly' | 'WRONG heal, test failed' | 'WRONG heal, test passed' | 'refused, element gone' | 'refused, element was there' | 'not reached';
const rows: { t: Truth; r?: HealRecord; outcome: Outcome }[] = [];
for (const b of baseline) {
  const t = runBy.get(key(b));
  const r = recBy.get(key(b));
  let outcome: Outcome;
  if (!t) outcome = 'not reached';
  else if (!r) outcome = t.got === t.truth ? 'no heal needed' : 'WRONG heal, test passed';
  else if (r.verdict === 'refuse') outcome = t.targetVisible ? 'refused, element was there' : 'refused, element gone';
  else if (t.got === t.truth) outcome = 'healed correctly';
  else outcome = r.status === 'verified' ? 'WRONG heal, test passed' : 'WRONG heal, test failed';
  rows.push({ t: t ?? b, r, outcome });
}

const count = (o: Outcome) => rows.filter((x) => x.outcome === o).length;
const out: string[] = [];
out.push(`## ${label}`, '');
out.push('| Test | Locator | Element | Outcome | Verdict | Confidence | Test after heal | New locator |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const { t, r, outcome } of rows) {
  out.push(`| ${t.test} | \`${t.selector}\` | ${t.truth} | ${outcome} | ${r?.verdict ?? '-'} | ${r ? r.confidence.toFixed(2) : '-'} | ${r ? r.status : '-'} | ${r?.newSelector ? '`' + r.newSelector.replace(/\|/g, '\\|') + '`' : '-'} |`);
}
const order: Outcome[] = ['no heal needed', 'healed correctly', 'WRONG heal, test failed', 'WRONG heal, test passed', 'refused, element gone', 'refused, element was there', 'not reached'];
out.push('', `**${rows.length} lookups:** ` + order.map((o) => `${o} ${count(o)}`).join(', ') + '.', '');

const healed = rows.filter((x) => x.r && x.r.verdict !== 'refuse');
const ok = healed.filter((x) => x.outcome === 'healed correctly').map((x) => x.r!.confidence);
const bad = healed.filter((x) => x.outcome.startsWith('WRONG')).map((x) => x.r!.confidence);
out.push('Auto-apply threshold sweep (heals the engine attempted; "wrong" means it picked a different element):', '', '| Threshold | Correct heals at or above | Wrong heals at or above |', '| --- | --- | --- |');
for (const th of [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]) {
  out.push(`| ${th.toFixed(2)} | ${ok.filter((c) => c >= th).length} of ${ok.length} | ${bad.filter((c) => c >= th).length} of ${bad.length} |`);
}
out.push('', `Correct heal confidences: ${ok.sort().map((c) => c.toFixed(2)).join(', ') || 'none'}. Wrong heal confidences: ${bad.sort().map((c) => c.toFixed(2)).join(', ') || 'none'}.`, '');
console.log(out.join('\n'));
