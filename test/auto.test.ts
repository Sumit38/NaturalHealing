import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SAVE, page as app } from '../demo/app.js';
import { applyInDir, loadRecords } from '../src/apply.js';
import { launchOptions } from './launch.js';

const root = resolve('.');
const url = (p: string) => pathToFileURL(join(root, p)).href;

// Ordinary tests: no import of the healer, no change for healing.
const playwrightTest = `
import { chromium } from 'playwright-core';
const browser = await chromium.launch(${JSON.stringify(launchOptions)});
const page = await browser.newPage();
try {
  await page.goto(process.env.APP_URL);
  await page.locator('#saveBtn').click({ timeout: 3000 });
} finally { await browser.close(); }
`;
const seleniumTest = `
import { Builder, By } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
const options = new chrome.Options().addArguments('--headless=new', '--no-sandbox');
const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
try {
  await driver.get(process.env.APP_URL);
  await driver.findElement(By.css('#saveBtn')).click();
} finally { await driver.quit(); }
`;

describe('healing without changing the tests', () => {
  let site: Server;
  let version = 'v1';
  let appUrl = '';
  // Inside the repo so the project can resolve playwright-core and selenium-webdriver from node_modules.
  const work = mkdtempSync(join(root, '.tmp-auto-'));

  before(async () => {
    site = createServer((_, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(app(version === 'v2' ? BASE_SAVE.replace('saveBtn', 'coloredButton') : undefined));
    });
    await new Promise<void>((r) => site.listen(0, '127.0.0.1', r));
    appUrl = `http://127.0.0.1:${(site.address() as AddressInfo).port}/`;
  });
  after(() => site.close());

  for (const [name, source] of [['playwright', playwrightTest], ['selenium', seleniumTest]] as const) {
    it(`${name}: learns when green, heals when the id changes, and can patch the source`, async () => {
      const dir = join(work, name);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, 'save.test.mjs');
      writeFileSync(file, source);
      // Async, because this process also serves the page the test opens.
      const run = (v: string, heal: string) => {
        version = v;
        return new Promise<{ status: number | null; stdout: string; stderr: string }>((done) =>
          execFile(
            'node',
            ['--import', url('node_modules/tsx/dist/esm/index.mjs'), '--import', url('src/auto/register.ts'), file],
            { cwd: dir, encoding: 'utf8', timeout: 90_000, env: { ...process.env, APP_URL: appUrl, HEAL_DIR: heal, HEAL_STORE: join(dir, 'fp.json') } },
            (err, stdout, stderr) => done({ status: err ? ((err as { code?: number }).code ?? 1) : 0, stdout, stderr }),
          ),
        );
      };
      const heal = join(dir, 'heal');

      const green = await run('v1', heal);
      assert.equal(green.status, 0, green.stdout + green.stderr);
      assert.equal(loadRecords(heal).length, 0);

      const broken = await run('v2', heal);
      assert.equal(broken.status, 0, 'the unmodified test passes because the locator was healed\n' + broken.stdout + broken.stderr);
      const [rec] = loadRecords(heal);
      assert.ok(rec, 'a heal was recorded');
      assert.equal(rec.oldSelector, '#saveBtn');
      assert.equal(rec.status, 'verified');
      assert.equal(rec.verifiedBy, 'step');
      assert.match(rec.file ?? '', /save\.test\.mjs$/);
      assert.equal(readFileSync(file, 'utf8'), source, 'source untouched until apply');

      const applied = applyInDir(heal, { approve: [rec.id] });
      assert.equal(applied[0]?.status, 'patched');
      assert.ok(!readFileSync(file, 'utf8').includes("'#saveBtn'"));

      const again = await run('v2', join(dir, 'heal2'));
      assert.equal(again.status, 0, 'the patched test passes with nothing to heal\n' + again.stdout + again.stderr);
      assert.equal(loadRecords(join(dir, 'heal2')).length, 0);
    });
  }
});
