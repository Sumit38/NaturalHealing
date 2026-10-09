import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright-core';
import { BASE_SAVE, SHADOW_SAVE, page as app } from '../demo/app.js';
import { Healer } from '../src/index.js';

type Expect = 'heal' | 'untouched' | 'not-auto' | 'refuse';
interface Scenario {
  name: string;
  selector: string;
  /** Page before and after the release. */
  before: string;
  after: string;
  expect: Expect;
  target?: string;
}

const NEWS = '<label><input id="news" type="checkbox" data-x="news"> Send me the newsletter</label>';
const TERMS = '<label><input type="checkbox" data-x="terms"> I accept the terms</label>';
const OPTS = '<option>Checking</option><option>Savings</option>';
const ACCOUNTS = (from: string, to: string) =>
  `<label for="${from}">From account</label><select id="${from}" data-x="from">${OPTS}</select><label for="${to}">To account</label><select id="${to}" data-x="to">${OPTS}</select>`;
const renamed = '<button id="coloredButton" class="btn primary" data-x="save">Save</button>';
const scenarios: Scenario[] = [
  { name: 'id renamed, same text (the Save button case)', selector: '#saveBtn', before: app(), after: app(renamed), expect: 'heal', target: 'save' },
  { name: 'class changed only, id kept', selector: '#saveBtn', before: app(), after: app(BASE_SAVE.replace('btn primary', 'x9f3a')), expect: 'untouched' },
  { name: 'text changed, id kept', selector: '#saveBtn', before: app(), after: app(BASE_SAVE.replace('>Save<', '>Save changes<')), expect: 'untouched' },
  { name: 'id renamed and text changed', selector: '#saveBtn', before: app(), after: app('<button id="b1" class="btn primary" data-x="save">Save changes</button>'), expect: 'heal', target: 'save' },
  { name: 'moved into a different container', selector: '#saveBtn', before: app(), after: app('', '<div class="toolbar"><button id="b1" class="btn primary" data-x="save">Save</button></div>'), expect: 'heal', target: 'save' },
  { name: 'wrapped in an extra div', selector: '#saveBtn', before: app(), after: app('<div class="wrap">' + renamed + '</div>'), expect: 'heal', target: 'save' },
  { name: 'id removed, class randomised', selector: '#saveBtn', before: app(), after: app('<button class="css-1x2y3z" data-x="save">Save</button>'), expect: 'heal', target: 'save' },
  { name: 'button became a link with role=button', selector: '#saveBtn', before: app(), after: app('<a role="button" id="b1" href="#" class="btn primary" data-x="save">Save</a>'), expect: 'heal', target: 'save' },
  { name: 'text input id renamed', selector: '#email', before: app(), after: app().replace('id="email"', 'id="emailAddress"'), expect: 'heal', target: 'email' },
  { name: 'Save and Cancel swapped, id renamed', selector: '#saveBtn', before: app(), after: app('').replace('<button id="cancelBtn"', renamed + '<button id="cancelBtn"').replace(renamed + '<button id="cancelBtn" class="btn" data-x="cancel">Cancel</button>', '<button id="cancelBtn" class="btn" data-x="cancel">Cancel</button>' + renamed), expect: 'heal', target: 'save' },
  { name: 'open shadow DOM, id renamed', selector: '#saveBtn', before: app('', SHADOW_SAVE(BASE_SAVE)), after: app('', SHADOW_SAVE(renamed)), expect: 'heal', target: 'save' },
  { name: 'icon-only button, id renamed', selector: '#saveBtn', before: app(), after: app('<button id="b1" class="btn primary" data-x="save">\u{1F4BE}</button>'), expect: 'not-auto' },
  { name: 'two Save buttons appear (ambiguous)', selector: '#saveBtn', before: app(), after: app('<button id="b1" class="btn primary" data-x="save">Save</button><button id="b2" class="btn primary" data-x="save2">Save</button>'), expect: 'not-auto' },
  { name: 'Save button removed entirely', selector: '#saveBtn', before: app(), after: app(''), expect: 'not-auto' },
  // Found on the local ShopBank app: a removed checkbox named by a wrapping label was matched to another checkbox.
  { name: 'wrapped-label checkbox removed, another remains', selector: '#news', before: app(BASE_SAVE, NEWS + TERMS), after: app(BASE_SAVE, TERMS), expect: 'refuse' },
  // Selects share their option text; the label must decide between From and To.
  { name: 'From and To selects both renamed', selector: '#fromAccount', before: app(BASE_SAVE, ACCOUNTS('fromAccount', 'toAccount')), after: app(BASE_SAVE, ACCOUNTS('source', 'destination')), expect: 'heal', target: 'from' },
];

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
let browser: Browser;
before(async () => {
  browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
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
      } else if (s.expect === 'refuse') {
        assert.ok(rec, 'a lookup failure should have been recorded');
        if (rec.verdict !== 'refuse') falseHeals++;
        assert.equal(rec.verdict, 'refuse', `the element is gone, but it healed to ${found}`);
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
