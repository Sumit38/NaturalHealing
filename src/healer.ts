import type { Locator, Page } from 'playwright-core';
import { browserFn } from './browser.js';
import { HealerCore, type Probe } from './core.js';
import type { Snapshot, UINode, Viewport } from './model.js';

export type { HealRecord, HealStatus, HealerOptions } from './core.js';

/** Playwright adapter. */
export class Healer extends HealerCore {
  /**
   * Drop-in for page.locator(selector). Healing runs only when the lookup
   * finds nothing; assertions are never touched.
   */
  async locate(page: Page, selector: string): Promise<Locator> {
    return page.locator(await this.resolve(playwrightProbe(page, this.lookupTimeout), selector));
  }
}

function playwrightProbe(page: Page, timeout: number): Probe {
  return {
    async count(selector) {
      const loc = page.locator(selector);
      await loc.first().waitFor({ state: 'attached', timeout }).catch(() => undefined);
      return loc.count();
    },
    async describe(selector) {
      const h = await page.locator(selector).elementHandle();
      return h ? ((await page.evaluate(browserFn as any, h)) as UINode) : null;
    },
    async snapshot() {
      return (await page.evaluate(browserFn as any)) as Snapshot;
    },
    async viewport() {
      return (await page.evaluate('({ w: window.innerWidth, h: window.innerHeight })')) as Viewport;
    },
    /** Test id, role plus name, id, then structure. */
    candidates(node) {
      const options: string[] = [];
      const tid = node.attrs['data-testid'] ?? node.attrs['data-test'];
      if (tid) options.push(`[data-testid=${JSON.stringify(tid)}]`);
      if (node.role !== 'generic' && node.name) options.push(`role=${node.role}[name=${JSON.stringify(node.name)}s]`);
      if (node.attrs.id && /^[A-Za-z][\w-]*$/.test(node.attrs.id)) options.push(`#${node.attrs.id}`);
      options.push(node.cssPath);
      return options;
    },
  };
}
