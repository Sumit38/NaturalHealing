import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { Healer } from '../../src/index.js';

/**
 * Wires the healer into Playwright Test. `find(selector, truth)` replaces
 * `page.locator(selector)`; `truth` is only used by the evaluation, which
 * logs what each lookup actually resolved to (the `data-truth` attribute,
 * which the healer never reads).
 */
type Find = (selector: string, truth: string) => Promise<Locator>;

const healer = new Healer({ lookupTimeout: 1000 });
const truthLog = process.env.TRUTH_LOG;
/** HEAL_OFF=1 runs the suite with plain page.locator, to see what breaks without healing. */
const off = process.env.HEAL_OFF === '1';

async function resolvedTruth(page: Page, loc: Locator): Promise<string | null> {
  return (await loc.count().catch(() => 0)) === 1 ? loc.getAttribute('data-truth', { timeout: 1000 }).catch(() => null) : null;
}

export const test = base.extend<{ find: Find }>({
  find: async ({ page }, use, info) => {
    healer.beginTest(info.title);
    await use(async (selector, truth) => {
      const loc = off ? page.locator(selector) : await healer.locate(page, selector, { file: info.file });
      if (truthLog) {
        const target = page.locator(`[data-truth="${truth}"]`);
        const entry = {
          test: info.title, selector, truth, got: await resolvedTruth(page, loc),
          targetPresent: (await target.count()) > 0, targetVisible: await target.first().isVisible().catch(() => false),
        };
        mkdirSync(join(truthLog, '..'), { recursive: true });
        appendFileSync(truthLog, JSON.stringify(entry) + '\n');
      }
      return loc;
    });
    healer.finish(info.title, info.status === info.expectedStatus);
  },
});

export { expect };
