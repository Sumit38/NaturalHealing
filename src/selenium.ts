import type { WebDriver, WebElement } from 'selenium-webdriver';
import { BROWSER_SRC } from './browser.js';
import { HealerCore, type Probe } from './core.js';
import type { Snapshot, UINode, Viewport } from './model.js';

export type { HealRecord, HealStatus, HealerOptions } from './core.js';

/**
 * Selenium (selenium-webdriver for JavaScript) adapter. Selectors are CSS,
 * or XPath when they start with "/" or "(".
 */
export class SeleniumHealer extends HealerCore {
  /**
   * Drop-in for driver.findElement(By.css(selector)). Healing runs only when
   * the lookup finds nothing; assertions are never touched.
   */
  async find(driver: WebDriver, selector: string): Promise<WebElement> {
    return driver.findElement(by(await this.resolve(seleniumProbe(driver, this.lookupTimeout), selector)));
  }
}

const isXPath = (selector: string) => selector.startsWith('/') || selector.startsWith('(');
const by = (selector: string) => (isXPath(selector) ? { xpath: selector } : { css: selector });

export function seleniumProbe(driver: WebDriver, timeout: number): Probe {
  const findAll = (selector: string) => driver.findElements(by(selector));
  return {
    async count(selector) {
      const deadline = Date.now() + timeout;
      for (;;) {
        const n = (await findAll(selector)).length;
        if (n > 0 || Date.now() >= deadline) return n;
        await new Promise((r) => setTimeout(r, 100));
      }
    },
    async describe(selector) {
      const [el] = await findAll(selector);
      return el ? ((await driver.executeScript(`return (${BROWSER_SRC})(arguments[0])`, el)) as UINode) : null;
    },
    async snapshot() {
      return (await driver.executeScript(`return (${BROWSER_SRC})()`)) as Snapshot;
    },
    async viewport() {
      return (await driver.executeScript('return { w: window.innerWidth, h: window.innerHeight }')) as Viewport;
    },
    /** Test id, id, name, visible text, placeholder, then structure. */
    candidates(node) {
      const options: string[] = [];
      for (const attr of ['data-testid', 'data-test']) {
        if (node.attrs[attr]) options.push(`[${attr}=${JSON.stringify(node.attrs[attr])}]`);
      }
      if (node.attrs.id && /^[A-Za-z][\w-]*$/.test(node.attrs.id)) options.push(`#${node.attrs.id}`);
      if (node.attrs.name) options.push(`${node.tag}[name=${JSON.stringify(node.attrs.name)}]`);
      if (node.text && node.text.length <= 60) options.push(`//${node.tag}[normalize-space()=${xpathString(node.text)}]`);
      if (node.attrs.placeholder) options.push(`${node.tag}[placeholder=${JSON.stringify(node.attrs.placeholder)}]`);
      options.push(node.cssPath);
      return options;
    },
  };
}

function xpathString(s: string): string {
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"')) return `"${s}"`;
  return `concat('${s.split("'").join(`', "'", '`)}')`;
}
