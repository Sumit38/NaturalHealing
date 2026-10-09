import type { HealRecord } from '../core.js';
import { elementKey, type CoverageFile } from '../auto/coverage.js';
import type { Bug, Severity } from './bugs.js';
import { matches, type Scenario } from './scenarios.js';

export interface TestResult {
  title: string;
  file?: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  flaky?: boolean;
  durationMs?: number;
  retries?: number;
  error?: string;
  errorLine?: string;
  /** The expected result was a guess made when the case was generated. */
  assumed?: boolean;
}

export interface ReportInput {
  runId: string;
  tests: TestResult[];
  /** Why there are no per-test results, when there are none. */
  resultsNote?: string;
  coverage: CoverageFile[];
  scenarios: Scenario[];
  bugs: Bug[];
  heals: HealRecord[];
}

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 10, high: 6, medium: 3, low: 1 };
const OPEN: Bug['status'][] = ['open', 'reopened', 'fixed'];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const isFail = (t: TestResult) => t.status === 'failed' || t.status === 'timedOut';
const priorityRank: Record<string, number> = { button: 0, textbox: 1, searchbox: 1, checkbox: 2, radio: 2, combobox: 2, switch: 2, link: 3 };

export interface RiskPart {
  label: string;
  points: number;
  max: number;
  detail: string;
}

export function buildReport(input: ReportInput) {
  const { tests, scenarios, bugs, heals } = input;

  // --- results -------------------------------------------------------------
  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter(isFail).length;
  const skipped = tests.filter((t) => t.status === 'skipped').length;
  const interrupted = tests.filter((t) => t.status === 'interrupted').length;
  const executed = passed + failed;
  const summary = {
    total: tests.length, executed, passed, failed, skipped, interrupted, flaky: tests.filter((t) => t.flaky).length,
    assumedFailed: tests.filter((t) => isFail(t) && t.assumed).length,
    passRate: pct(passed, executed), durationMs: tests.reduce((n, t) => n + (t.durationMs ?? 0), 0),
  };

  // --- coverage ------------------------------------------------------------
  const pages = new Map<string, { url: string; title?: string; elements: Map<string, { role: string; name: string; tag: string }>; links: Set<string> }>();
  const touched = new Map<string, Set<string>>();
  for (const f of input.coverage) {
    for (const p of Object.values(f.pages)) {
      const cur = pages.get(p.url) ?? { url: p.url, title: p.title, elements: new Map(), links: new Set<string>() };
      for (const e of p.elements) cur.elements.set(elementKey(e), e);
      for (const l of p.links) cur.links.add(l);
      pages.set(p.url, cur);
    }
    for (const t of f.touched) {
      const set = touched.get(t.page) ?? new Set<string>();
      set.add(elementKey(t));
      touched.set(t.page, set);
    }
  }
  const visited = [...pages.keys()];
  const linkedFrom = new Map<string, string[]>();
  for (const p of pages.values()) for (const l of p.links) if (!pages.has(l)) linkedFrom.set(l, [...(linkedFrom.get(l) ?? []), p.url]);
  const unvisited = [...linkedFrom.keys()];

  let elementsTotal = 0;
  let elementsTouched = 0;
  const pageRows = visited.map((url) => {
    const p = pages.get(url)!;
    const t = touched.get(url) ?? new Set<string>();
    const all = [...p.elements.entries()];
    const hit = all.filter(([k]) => t.has(k)).length;
    elementsTotal += all.length;
    elementsTouched += hit;
    const untouched = all
      .filter(([k]) => !t.has(k))
      .map(([, e]) => e)
      .sort((a, b) => (priorityRank[a.role] ?? 4) - (priorityRank[b.role] ?? 4));
    return { url, title: p.title, visited: true, elements: all.length, touched: hit, pct: pct(hit, all.length), untouched };
  });
  const havePages = visited.length > 0;
  const coverage = {
    measured: havePages,
    pages: { visited: visited.length, discovered: visited.length + unvisited.length, pct: pct(visited.length, visited.length + unvisited.length) },
    elements: { total: elementsTotal, touched: elementsTouched, pct: pct(elementsTouched, elementsTotal) },
    pageRows,
    uncoveredPages: unvisited.map((url) => ({ url, linkedFrom: linkedFrom.get(url)! })),
  };

  // --- scenarios ------------------------------------------------------------
  const claimed = new Set<TestResult>();
  const scenarioRows = scenarios.map((s) => {
    const ts = tests.filter((t) => matches(s, t.title));
    ts.forEach((t) => claimed.add(t));
    const status = !ts.length ? 'no-test' : ts.some(isFail) ? 'failed' : ts.every((t) => t.status === 'skipped' || t.status === 'interrupted') ? 'skipped' : 'passed';
    return { ...s, status, tests: ts.map((t) => ({ title: t.title, status: t.status })) };
  });
  const unattendedScenarios = scenarioRows.filter((r) => r.status === 'no-test' || r.status === 'skipped');
  const unattendedTests = tests.filter((t) => t.status === 'skipped' || t.status === 'interrupted').map((t) => ({ title: t.title, status: t.status }));
  const scenarioCoverage = scenarios.length ? { planned: scenarios.length, attended: scenarios.length - unattendedScenarios.length, pct: pct(scenarios.length - unattendedScenarios.length, scenarios.length) } : null;

  // --- bugs -----------------------------------------------------------------
  const closedOnPurpose = (b: Bug) => b.status === 'not-a-bug' || b.status === 'wont-fix';
  const failingKeys = new Set(tests.filter(isFail).map((t) => `${t.file ?? ''}::${t.title}`));
  const defectsFound = bugs.filter((b) => failingKeys.has(b.key) && !closedOnPurpose(b));
  const openNow = bugs.filter((b) => OPEN.includes(b.status));
  const bySeverity = (list: Bug[]) => (['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => ({ severity: s, count: list.filter((b) => b.severity === s).length }));
  const retested = bugs.filter((b) => b.retest);
  const retest = {
    verified: bugs.filter((b) => b.status === 'verified').length,
    reopened: bugs.filter((b) => b.status === 'reopened' && b.retest).length,
    pending: bugs.filter((b) => b.status === 'fixed').length,
    inThisRun: retested.filter((b) => b.retest!.runId === input.runId).length,
    list: retested.map((b) => ({ id: b.id, title: b.title, status: b.status, result: b.retest!.result, runId: b.retest!.runId })),
  };
  const bugStats = {
    total: bugs.length,
    open: bugs.filter((b) => b.status === 'open').length,
    reopened: bugs.filter((b) => b.status === 'reopened').length,
    fixed: bugs.filter((b) => b.status === 'fixed').length,
    verified: bugs.filter((b) => b.status === 'verified').length,
    closed: bugs.filter(closedOnPurpose).length,
    openNow: openNow.length,
    openBySeverity: bySeverity(openNow),
  };

  // --- defect density and residual risk --------------------------------------
  const density = {
    perHundredTests: executed ? Math.round((defectsFound.length / executed) * 1000) / 10 : null,
    perPage: visited.length ? Math.round((defectsFound.length / visited.length) * 100) / 100 : null,
    residualPerHundredTests: executed ? Math.round((openNow.length / executed) * 1000) / 10 : null,
    found: defectsFound.length,
    residual: openNow.length,
  };

  const parts: RiskPart[] = [];
  const weighted = openNow.reduce((n, b) => n + (b.status === 'fixed' ? 0.5 : 1) * SEVERITY_WEIGHT[b.severity], 0);
  parts.push({ label: 'Open defects', max: 35, points: 35 * Math.min(1, weighted / 20), detail: `${openNow.length} not yet verified fixed, weighted by severity` });
  const confirmedFailed = failed - summary.assumedFailed;
  if (executed) parts.push({ label: 'Failing tests', max: 15, points: 15 * (confirmedFailed / executed), detail: `${confirmedFailed} of ${executed} executed tests failed${summary.assumedFailed ? ` (${summary.assumedFailed} more failed on an assumed expectation; not counted, they need a decision)` : ''}` });
  if (coverage.measured) {
    parts.push({ label: 'Pages not visited', max: 15, points: 15 * (1 - (coverage.pages.visited / Math.max(1, coverage.pages.discovered))), detail: `${unvisited.length} linked page(s) never opened by a test` });
    if (elementsTotal) parts.push({ label: 'Elements not exercised', max: 10, points: 10 * (1 - elementsTouched / elementsTotal), detail: `${elementsTotal - elementsTouched} of ${elementsTotal} controls on tested pages` });
  }
  const unattendedShare = scenarios.length ? unattendedScenarios.length / scenarios.length : tests.length ? (skipped + interrupted) / tests.length : 0;
  if (scenarios.length || tests.length) {
    parts.push({
      label: 'Unattended scenarios', max: 15, points: 15 * unattendedShare,
      detail: scenarios.length ? `${unattendedScenarios.length} of ${scenarios.length} planned scenarios had no passing or failing test` : `${skipped + interrupted} tests were skipped or did not finish (no scenario list supplied)`,
    });
  }
  const pendingHeals = heals.filter((h) => h.status === 'verified').length;
  if (heals.length) parts.push({ label: 'Locator fixes not applied', max: 10, points: 10 * Math.min(1, pendingHeals / 5), detail: `${pendingHeals} healed locator(s) still need to be saved into the tests` });
  const maxSum = parts.reduce((n, p) => n + p.max, 0);
  const score = maxSum ? Math.round((parts.reduce((n, p) => n + p.points, 0) / maxSum) * 100) : 0;
  const level = score < 25 ? 'low' : score < 50 ? 'medium' : score < 75 ? 'high' : 'critical';
  for (const p of parts) p.points = Math.round(p.points * 10) / 10;

  return {
    summary, resultsNote: input.resultsNote,
    tests: tests.map((t) => ({ title: t.title, file: t.file, status: t.status, assumed: !!t.assumed, flaky: !!t.flaky, durationMs: t.durationMs ?? 0, error: t.errorLine })),
    coverage,
    scenarios: { provided: scenarios.length > 0, coverage: scenarioCoverage, rows: scenarioRows, unattended: unattendedScenarios, unattendedTests, unplannedTests: scenarios.length ? tests.filter((t) => !claimed.has(t)).length : 0 },
    bugs, bugStats, retest, density,
    risk: { score, level, parts },
    healing: { failures: heals.length, healed: heals.filter((h) => h.status === 'verified' || h.status === 'patched').length, applied: heals.filter((h) => h.status === 'patched').length, pending: pendingHeals },
  };
}

export type Report = ReturnType<typeof buildReport>;
