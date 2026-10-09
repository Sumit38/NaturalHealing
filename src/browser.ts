/**
 * Code that runs inside the page. It is kept as a string so that the
 * TypeScript toolchain cannot inject helpers into it. Playwright calls the
 * function with one argument: an element (describe it) or undefined (collect
 * every visible element, walking open shadow roots).
 */
export const BROWSER_SRC = `(target) => {
  const IMPLICIT = { a: 'link', button: 'button', select: 'combobox', textarea: 'textbox', img: 'img',
    h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
    li: 'listitem', ul: 'list', nav: 'navigation', form: 'form', table: 'table' };
  const INPUT = { checkbox: 'checkbox', radio: 'radio', button: 'button', submit: 'button',
    reset: 'button', range: 'slider', search: 'searchbox' };
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const roleOf = (el) => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') return INPUT[(el.getAttribute('type') || 'text').toLowerCase()] || 'textbox';
    return IMPLICIT[tag] || 'generic';
  };
  const ownText = (el) => clean(Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '));
  const nameOf = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    if (el.id) {
      const root = el.getRootNode();
      const lab = root.querySelector ? root.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
      if (lab) return clean(lab.textContent);
    }
    // A label wrapping the control names it too (<label><input> Remember me</label>).
    const wrap = el.closest && ['input', 'select', 'textarea'].includes(el.tagName.toLowerCase()) ? el.closest('label') : null;
    if (wrap) return clean(wrap.textContent);
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      // value is a name only for button-like inputs; for fields it is user data that changes.
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      const value = ['button', 'submit', 'reset'].includes(type) ? el.getAttribute('value') : null;
      return clean(el.getAttribute('placeholder') || value || el.getAttribute('name'));
    }
    const t = clean(el.textContent);
    return t.length > 80 ? t.slice(0, 80) : t;
  };
  const parentOf = (el) => el.parentElement || (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null);
  const siblingsOf = (el) => (el.parentElement ? Array.from(el.parentElement.children) : (el.getRootNode().children ? Array.from(el.getRootNode().children) : [el]));
  const cssPath = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur.tagName.toLowerCase() !== 'html') {
      const sibs = siblingsOf(cur);
      parts.unshift(cur.tagName.toLowerCase() + ':nth-child(' + (sibs.indexOf(cur) + 1) + ')');
      cur = parentOf(cur);
    }
    return parts.join(' ');
  };
  const describe = (el) => {
    const r = el.getBoundingClientRect();
    const attrs = {};
    for (const k of ['id', 'name', 'type', 'href', 'placeholder', 'data-testid', 'data-test', 'for', 'title']) {
      const v = el.getAttribute(k);
      if (v) attrs[k] = v;
    }
    const ancestors = [];
    let p = parentOf(el);
    while (p && ancestors.length < 3) { ancestors.push(p.tagName.toLowerCase()); p = parentOf(p); }
    return {
      tag: el.tagName.toLowerCase(), role: roleOf(el), name: nameOf(el), text: ownText(el) || clean(el.textContent).slice(0, 80),
      attrs, classes: Array.from(el.classList), ancestors, siblingIndex: siblingsOf(el).indexOf(el),
      rect: { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height }, cssPath: cssPath(el),
    };
  };
  if (target) return describe(target);
  const nodes = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'head', 'meta', 'link', 'title', 'html', 'body'].includes(tag)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      nodes.push(describe(el));
    }
  };
  walk(document);
  return { viewport: { w: window.innerWidth, h: window.innerHeight }, nodes };
}`;

/** The same code as a real function, so Playwright can pass it an argument. */
export const browserFn = new Function(`return ${BROWSER_SRC}`)() as (target?: unknown) => unknown;
