// Mocha reporter: the normal "spec" output, plus a structured result file for the web app's report.
const fs = require('node:fs');
const path = require('node:path');

// Load the project's own Mocha, not one relative to this file.
const mochaPath = require.resolve('mocha', { paths: [process.cwd()] });
const Mocha = require(mochaPath);
const { Spec } = Mocha.reporters;
const { EVENT_RUN_END, EVENT_TEST_PASS, EVENT_TEST_FAIL, EVENT_TEST_PENDING } = Mocha.Runner.constants;

class HealMochaReporter extends Spec {
  constructor(runner, options) {
    super(runner, options);
    const tests = [];
    const add = (test, status, err) => {
      const message = err ? String(err.message || err) : undefined;
      tests.push({
        title: test.fullTitle(),
        file: test.file,
        status,
        flaky: false,
        durationMs: test.duration || 0,
        retries: 0,
        error: message,
        errorLine: message ? message.split('\n').find((l) => l.trim()) : undefined,
      });
    };
    runner.on(EVENT_TEST_PASS, (t) => add(t, 'passed'));
    runner.on(EVENT_TEST_FAIL, (t, err) => add(t, /timeout/i.test(String(err && err.message)) ? 'timedOut' : 'failed', err));
    runner.on(EVENT_TEST_PENDING, (t) => add(t, 'skipped'));
    runner.once(EVENT_RUN_END, () => {
      const dir = process.env.HEAL_DIR;
      if (!dir) return;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ framework: 'mocha', tests }, null, 2));
    });
  }
}

module.exports = HealMochaReporter;
