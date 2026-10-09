import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = resolve('.');
const url = (p: string) => pathToFileURL(join(root, p)).href;
const tsx = url('node_modules/tsx/dist/esm/index.mjs');
import { launchOptions } from './launch.js';
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };

const spec = `
import { chromium } from '${url('node_modules/playwright-core/index.mjs')}';
import { BASE_SAVE, page as app } from '${url('demo/app.ts')}';
import { Healer } from '${url('src/index.ts')}';
const v2 = process.env.PAGE_VERSION === 'v2';
const html = app(v2 ? BASE_SAVE.replace('saveBtn', 'coloredButton') : undefined);
const browser = await chromium.launch(${JSON.stringify(launchOptions)});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const healer = new Healer();
healer.beginTest('save profile');
let ok = false;
try {
  await page.setContent(html);
  await (await healer.locate(page, '#saveBtn')).click({ timeout: 2000 });
  ok = true;
} finally {
  healer.finish('save profile', ok);
  await browser.close();
}
`;

describe('heal command line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-'));
  const heal = (args: string[], extra: Record<string, string> = {}) =>
    spawnSync('node', ['--import', tsx, join(root, 'src/cli.ts'), ...args], { cwd: dir, env: { ...env, ...extra }, encoding: 'utf8' });
  const test = ['node', '--import', tsx, 'save.spec.mts'];

  it('records nothing on a green run, heals after the UI changes, and commits the fix on a branch', () => {
    writeFileSync(join(dir, 'save.spec.mts'), spec);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir, env });

    const green = heal(['run', '--', ...test], { PAGE_VERSION: 'v1' });
    assert.equal(green.status, 0, green.stdout + green.stderr);
    assert.match(green.stdout, /No heals recorded/);

    const broken = heal(['run', '--', ...test], { PAGE_VERSION: 'v2' });
    assert.equal(broken.status, 0, broken.stdout + broken.stderr);
    assert.match(broken.stdout, /auto\s+0\.\d+\s+verified\s+save profile/);
    assert.ok(existsSync(join(dir, '.heal/report.html')));

    assert.match(readFileSync(join(dir, 'save.spec.mts'), 'utf8'), /'#saveBtn'/, 'source untouched until apply');
    const pr = heal(['pr', '--no-push'], {});
    assert.equal(pr.status, 0, pr.stdout + pr.stderr);
    assert.match(pr.stdout, /Committed on branch heal\//);

    const src = readFileSync(join(dir, 'save.spec.mts'), 'utf8');
    assert.ok(src.includes('role=button[name=\\"Save\\"s]'), src);
    const log = execFileSync('git', ['log', '--oneline', '-1'], { cwd: dir, encoding: 'utf8' });
    assert.match(log, /Heal 1 locator/);
  });

  it('the patched test now passes without healing', () => {
    const after = heal(['run', '--', ...test], { PAGE_VERSION: 'v2' });
    assert.equal(after.status, 0, after.stdout + after.stderr);
    assert.match(after.stdout, /No heals recorded/);
  });
});
