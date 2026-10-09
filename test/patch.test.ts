import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser } from 'playwright-core';
import { BASE_SAVE, page as app } from '../demo/app.js';
import { Healer } from '../src/index.js';

import { launchOptions } from './launch.js';
let browser: Browser;
before(async () => {
  browser = await chromium.launch(launchOptions);
});
after(async () => {
  await browser.close();
});

const renamed = BASE_SAVE.replace('saveBtn', 'coloredButton');

async function scenario(testPasses: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'patch-'));
  const spec = join(dir, 'save.spec.ts');
  writeFileSync(spec, `export const find = (healer: any, page: any) => healer.locate(page, '#saveBtn');\n`);
  const { find } = await import(pathToFileURL(spec).href);
  const healer = new Healer({ storeFile: join(dir, 'fp.json') });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  healer.beginTest('save');
  await p.setContent(app());
  await find(healer, p);
  await p.setContent(app(renamed));
  await (await find(healer, p)).click();
  healer.finish('save', testPasses);
  const patched = healer.applyPatches();
  await p.close();
  return { spec, healer, patched };
}

describe('verification and patching', () => {
  it('rewrites the test source when the heal is auto-confidence and the test passes', async () => {
    const { spec, healer, patched } = await scenario(true);
    assert.equal(healer.records[0].verdict, 'auto');
    assert.equal(patched.length, 1);
    assert.equal(healer.records[0].status, 'patched');
    const src = readFileSync(spec, 'utf8');
    assert.ok(!src.includes("'#saveBtn'"), 'old selector should be gone');
    assert.ok(src.includes('role=button[name=\\"Save\\"s]'), `new role selector expected, got: ${src}`);
  });

  it('leaves the source alone when the healed test then fails', async () => {
    const { spec, healer, patched } = await scenario(false);
    assert.equal(patched.length, 0);
    assert.equal(healer.records[0].status, 'failed-verification');
    assert.ok(readFileSync(spec, 'utf8').includes("'#saveBtn'"));
  });
});
