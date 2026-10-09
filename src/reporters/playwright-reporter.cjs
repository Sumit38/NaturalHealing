// Playwright Test reporter: writes one structured result file for the web app's report.
// Added next to the user's own reporters by the runner (`--reporter=list,<this file>`).
const fs = require('node:fs');
const path = require('node:path');

class HealReporter {
  constructor() {
    this.tests = [];
  }
  onTestEnd(test, result) {
    const outcome = test.outcome();
    const status = outcome === 'skipped' ? 'skipped' : outcome === 'unexpected' ? (result.status === 'timedOut' ? 'timedOut' : result.status === 'interrupted' ? 'interrupted' : 'failed') : 'passed';
    const err = result.error || (result.errors && result.errors[0]);
    const message = err ? stripAnsi(err.message || String(err)) : undefined;
    const parts = test.titlePath().slice(3);
    this.tests.push({
      title: parts.join(' › ') || test.title,
      file: test.location && test.location.file,
      status,
      flaky: outcome === 'flaky',
      durationMs: result.duration,
      retries: result.retry,
      error: message,
      errorLine: message ? message.split('\n').find((l) => l.trim()) : undefined,
    });
  }
  onEnd() {
    const dir = process.env.HEAL_DIR;
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    // A retried test reports once per attempt; keep the last attempt.
    const last = new Map();
    for (const t of this.tests) last.set(t.file + '::' + t.title, t);
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ framework: 'playwright', tests: [...last.values()] }, null, 2));
  }
  printsToStdio() {
    return false;
  }
}

function stripAnsi(s) {
  return String(s).replace(/\u001b\[[0-9;]*m/g, '');
}

module.exports = HealReporter;
