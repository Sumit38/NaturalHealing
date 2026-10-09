import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CoverageFile } from '../auto/coverage.js';
import type { Severity } from './bugs.js';
import type { TestResult } from './report.js';
import { matches, type Scenario } from './scenarios.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const reporter = (name: string) => join(HERE, '..', 'reporters', name).replace(/\\/g, '/');

/**
 * Adds a result reporter to the test command, when the command runs Playwright Test or Mocha, so the report
 * can list every test. Other commands still run; they just get a single pass/fail result.
 */
export function withReporter(command: string, cwd: string): string {
  let scriptText = '';
  const viaNpm = /^npm\s+(run\s+)?test\b/.test(command.trim());
  if (viaNpm) {
    try {
      scriptText = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).scripts?.test ?? '';
    } catch {
      /* no package.json */
    }
  }
  const text = `${command} ${scriptText}`;
  if (/--reporter\b/.test(text)) return command;
  const extra = /playwright(\.js)?["']?\s+test\b|cli\.js["']?\s+test\b/.test(text)
    ? `--reporter=list,"${reporter('playwright-reporter.cjs')}"`
    : /\bmocha\b/.test(text)
      ? `--reporter "${reporter('mocha-reporter.cjs')}"`
      : '';
  if (!extra) return command;
  return viaNpm ? `${command} -- ${extra}` : `${command} ${extra}`;
}

export function readResults(healDir: string): { tests: TestResult[]; note?: string } | undefined {
  const file = join(healDir, 'results.json');
  if (!existsSync(file)) return undefined;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as { tests: TestResult[] };
    return { tests: data.tests ?? [] };
  } catch {
    return undefined;
  }
}

/** When no reporter ran, the run itself is the only test there is. */
export function syntheticResult(name: string, status: string, log: string): { tests: TestResult[]; note?: string } {
  if (status === 'passed') return { tests: [{ title: name, status: 'passed' }], note: 'Per-test results are not available for this command, so the whole run counts as one test. Playwright Test and Mocha give a full list.' };
  if (status === 'failed') {
    const line = [...log.split(/\r?\n/)].reverse().find((l) => /error|fail|expected|timeout/i.test(l) && !/^\[runner\]/.test(l)) ?? 'The test command exited with an error.';
    return { tests: [{ title: name, status: 'failed', errorLine: line.trim().slice(0, 200), error: line.trim() }], note: 'Per-test results are not available for this command, so the whole run counts as one test. Playwright Test and Mocha give a full list.' };
  }
  return { tests: [], note: 'The run did not complete, so there are no test results.' };
}

export function readCoverage(healDir: string): CoverageFile[] {
  const dir = join(healDir, 'coverage');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      try {
        return [JSON.parse(readFileSync(join(dir, f), 'utf8')) as CoverageFile];
      } catch {
        return [];
      }
    });
}

const SEVERITY_WORDS: [RegExp, Severity][] = [
  [/crit|p0|blocker|sev ?1/i, 'critical'],
  [/high|p1|major|sev ?2/i, 'high'],
  [/med|p2|normal|sev ?3/i, 'medium'],
  [/low|p3|minor|trivial|sev ?4/i, 'low'],
];

/** A bug in a test that belongs to a planned scenario takes that scenario's priority. */
export function severityFromScenario(scenarios: Scenario[], testTitle: string): { severity?: Severity; scenarioId?: string } {
  const s = scenarios.find((x) => matches(x, testTitle));
  if (!s) return {};
  const severity = s.priority ? SEVERITY_WORDS.find(([re]) => re.test(s.priority!))?.[1] : undefined;
  return { severity, scenarioId: s.id };
}
