import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Probe } from '../core.js';
import type { Snapshot, UINode } from '../model.js';

/** One interactive element on a page, identified by what a person would call it. */
export interface ElementRef {
  role: string;
  name: string;
  tag: string;
}

export interface PageCoverage {
  url: string;
  title?: string;
  /** Interactive elements seen on the page (from inside the test's own session, so logged-in pages count). */
  elements: ElementRef[];
  /** Same-origin pages this page links to, whether or not a test ever opened them. */
  links: string[];
}

export interface CoverageFile {
  pages: Record<string, PageCoverage>;
  /** Elements the tests acted on, per page. */
  touched: { page: string; role: string; name: string; tag: string }[];
}

/** What the recorder needs from a framework to look at the current page. */
export interface PageLike {
  url(): Promise<string> | string;
  title(): Promise<string> | string;
  snapshot(): Promise<Snapshot>;
}

const INTERACTIVE_ROLES = new Set([
  'link', 'button', 'textbox', 'searchbox', 'checkbox', 'radio', 'combobox', 'slider', 'switch', 'tab', 'menuitem', 'option', 'spinbutton',
]);
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);

/** Origin and path only, so ?utm=1 and trailing slashes do not make a page look like two. SPA hash routes are kept. */
export function normalizeUrl(raw: string, base?: string): string | undefined {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : u.pathname;
    const hash = /^#!?\//.test(u.hash) ? u.hash : '';
    return u.origin + path + hash;
  } catch {
    return undefined;
  }
}

export const elementKey = (e: { role: string; name: string; tag: string }) => `${e.role}|${e.name.toLowerCase()}|${e.tag}`;

const isInteractive = (n: UINode) => INTERACTIVE_ROLES.has(n.role) || INTERACTIVE_TAGS.has(n.tag);
const refOf = (n: UINode): ElementRef => ({ role: n.role, name: (n.name || n.text || '').slice(0, 80), tag: n.tag });

/** Collects which pages and elements the tests reached. Never throws: coverage must not break a test. */
export class CoverageRecorder {
  private data: CoverageFile = { pages: {}, touched: [] };
  private readonly seenTouch = new Set<string>();
  private readonly file: string;

  constructor(dir: string) {
    this.file = join(dir, 'coverage', `${process.pid}.json`);
  }

  /** Records the page the browser is on now, once per URL. */
  async visit(page: PageLike): Promise<string | undefined> {
    try {
      const url = normalizeUrl(await page.url());
      if (!url) return undefined;
      if (this.data.pages[url]) return url;
      const snap = await page.snapshot();
      const base = String(await page.url());
      const elements = new Map<string, ElementRef>();
      const links = new Set<string>();
      for (const n of snap.nodes) {
        if (!isInteractive(n)) continue;
        const ref = refOf(n);
        if (ref.name || ref.tag !== 'a') elements.set(elementKey(ref), ref);
        if (n.tag === 'a' && n.attrs.href) {
          const target = normalizeUrl(n.attrs.href, base);
          if (target && new URL(target).origin === new URL(url).origin && target !== url) links.add(target);
        }
      }
      this.data.pages[url] = { url, title: await page.title(), elements: [...elements.values()].slice(0, 300), links: [...links].slice(0, 200) };
      this.save();
      return url;
    } catch {
      return undefined;
    }
  }

  /** Records that the test acted on the element a selector points to. */
  async interact(page: PageLike, probe: Probe, selector: string): Promise<void> {
    try {
      const url = normalizeUrl(await page.url());
      if (!url) return;
      const dedupe = `${url}|${selector}`;
      if (this.seenTouch.has(dedupe)) return;
      this.seenTouch.add(dedupe);
      const node = await probe.describe(selector);
      if (!node) return;
      await this.visit(page);
      const ref = refOf(node);
      const entry = this.data.pages[url];
      // An element that appeared after the first look (a menu, a dialog) still belongs in the page's inventory.
      if (entry && !entry.elements.some((e) => elementKey(e) === elementKey(ref))) entry.elements.push(ref);
      this.data.touched.push({ page: url, ...ref });
      this.save();
    } catch {
      /* coverage is best effort */
    }
  }

  private save() {
    try {
      mkdirSync(join(this.file, '..'), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }
}
