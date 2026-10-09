import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright-core';
import { scenarios } from '../demo/scenarios.js';
import { Healer } from '../src/index.js';

import { launchOptions } from './launch.js';
let browser: Browser;
before(async () => {
  browser = await chromium.launch(launchOptions);
});
after(async () => {
  await browser.close();
});

describe('healing bench', () => {
  const rows: Record<string, string | number>[] = [];
  let healedCorrect = 0;
  let shouldHeal = 0;
  let falseHeals = 0;

  for (const s of scenarios) {
    it(s.name, async () => {
      const healer = new Healer({ storeFile: join(mkdtempSync(join(tmpdir(), 'heal-')), 'fp.json') });
      const p: Page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      healer.beginTest(s.name);
      await p.setContent(s.before);
      await healer.locate(p, s.selector); // green run: fingerprint saved
      await p.setContent(s.after);
      const loc = await healer.locate(p, s.selector);
      const rec = healer.records.at(-1);
      const found = (await loc.count()) === 1 ? await loc.getAttribute('data-x') : null;
      rows.push({ scenario: s.name, verdict: rec?.verdict ?? 'none needed', confidence: rec ? +rec.confidence.toFixed(2) : '-', found: found ?? 'nothing' });

      if (s.expect === 'untouched') {
        assert.equal(rec, undefined, 'lookup still worked, so healing must not run');
      } else if (s.expect === 'heal') {
        shouldHeal++;
        assert.ok(rec, 'a lookup failure should have been recorded');
        if (rec.verdict !== 'refuse') {
          if (found === s.target) healedCorrect++;
          else falseHeals++;
        }
        assert.ok(found === s.target || rec.verdict === 'refuse', `healed to the wrong element: ${found}`);
      } else {
        assert.ok(rec, 'a lookup failure should have been recorded');
        assert.notEqual(rec.verdict, 'auto', 'ambiguous or missing targets must never auto-heal');
        if (rec.verdict === 'suggest' && found !== 'save') falseHeals++;
      }
      await p.close();
    });
  }

  it('summary: no false heals and a high heal rate', () => {
    console.table(rows);
    console.log(`healed correctly ${healedCorrect}/${shouldHeal}, false heals ${falseHeals}`);
    assert.equal(falseHeals, 0);
    assert.ok(healedCorrect / shouldHeal >= 0.8, 'heal rate below 80%');
  });
});
