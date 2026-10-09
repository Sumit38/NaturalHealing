import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { BASE_SAVE, page as app } from '../demo/app.js';
import { scenarios } from '../demo/scenarios.js';
import { SeleniumHealer } from '../src/selenium.js';

// Chromedriver must match the Chrome version; set CHROMEDRIVER and CHROME_BIN to use your own.
const chromeBin = [process.env.CHROME_BIN, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => p && existsSync(p));
const driverBin = [process.env.CHROMEDRIVER].find((p) => p && existsSync(p));

let driver: WebDriver;
before(async () => {
  const options = new chrome.Options();
  options.addArguments('--headless=new', '--no-sandbox', '--window-size=1280,720');
  if (chromeBin) options.setChromeBinaryPath(chromeBin);
  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  if (driverBin) builder.setChromeService(new chrome.ServiceBuilder(driverBin));
  driver = await builder.build();
});
after(async () => {
  await driver?.quit();
});

const pages = mkdtempSync(join(tmpdir(), 'sel-pages-'));
let n = 0;
async function show(html: string) {
  const file = join(pages, `p${n++}.html`);
  writeFileSync(file, html);
  await driver.get(pathToFileURL(file).href);
}

describe('selenium healing bench', () => {
  const rows: Record<string, string | number>[] = [];
  let healedCorrect = 0;
  let shouldHeal = 0;
  let falseHeals = 0;

  // Plain CSS and XPath in Selenium do not reach inside shadow DOM, so that scenario is Playwright only.
  for (const s of scenarios.filter((x) => !x.name.includes('shadow DOM'))) {
    it(s.name, async () => {
      const healer = new SeleniumHealer({ storeFile: join(mkdtempSync(join(tmpdir(), 'heal-')), 'fp.json') });
      healer.beginTest(s.name);
      await show(s.before);
      await healer.find(driver, s.selector); // green run: fingerprint saved
      await show(s.after);
      const el = await healer.find(driver, s.selector).catch(() => null);
      const rec = healer.records.at(-1);
      const found = el ? await el.getAttribute('data-x') : null;
      rows.push({ scenario: s.name, verdict: rec?.verdict ?? 'none needed', confidence: rec ? +rec.confidence.toFixed(2) : '-', selector: rec?.newSelector ?? '-', found: found ?? 'nothing' });

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
    });
  }

  it('summary: no false heals', () => {
    console.table(rows);
    console.log(`selenium: healed correctly ${healedCorrect}/${shouldHeal}, false heals ${falseHeals}`);
    assert.equal(falseHeals, 0);
  });
});

describe('selenium verification and patching', () => {
  it('rewrites the test source when the heal is auto-confidence and the test passes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sel-patch-'));
    const spec = join(dir, 'save.spec.ts');
    writeFileSync(spec, `export const find = (healer: any, driver: any) => healer.find(driver, '#saveBtn');\n`);
    const { find } = await import(pathToFileURL(spec).href);
    const healer = new SeleniumHealer({ storeFile: join(dir, 'fp.json') });
    healer.beginTest('save');
    await show(app());
    await find(healer, driver);
    await show(app(BASE_SAVE.replace('saveBtn', 'coloredButton')));
    await (await find(healer, driver)).click();
    healer.finish('save', true);
    const patched = healer.applyPatches();
    assert.equal(healer.records[0].verdict, 'auto');
    assert.equal(patched.length, 1);
    const src = readFileSync(spec, 'utf8');
    assert.ok(!src.includes("'#saveBtn'"), 'old selector should be gone');
    assert.ok(src.includes('"#coloredButton"') || src.includes('normalize-space()'), `a Selenium selector expected, got: ${src}`);
  });
});
