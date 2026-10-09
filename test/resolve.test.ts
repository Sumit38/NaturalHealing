import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rank, similarity, words } from '../src/exec/resolve.js';
import type { UINode } from '../src/model.js';

let y = 0;
const node = (p: Partial<UINode> & { tag: string; role: string; name?: string }): UINode => ({
  text: '', attrs: {}, classes: [], ancestors: [], siblingIndex: 0, cssPath: `${p.tag}:nth-child(${++y})`, rect: { x: 10, y: y * 40, w: 120, h: 30 }, name: '', ...p,
});

const page: UINode[] = [
  node({ tag: 'input', role: 'textbox', name: 'Email', attrs: { id: 'emailField', type: 'email', placeholder: 'you@example.com' } }),
  node({ tag: 'input', role: 'textbox', name: 'Password', attrs: { id: 'pw', type: 'password' } }),
  node({ tag: 'input', role: 'checkbox', name: 'Remember me', attrs: { type: 'checkbox' } }),
  node({ tag: 'button', role: 'button', name: 'Sign in', text: 'Sign in', attrs: { id: 'btn-login-9f2' } }),
  node({ tag: 'button', role: 'button', name: 'Save changes', text: 'Save changes' }),
  node({ tag: 'a', role: 'link', name: 'Forgot password?', text: 'Forgot password?', attrs: { href: '/forgot' } }),
  node({ tag: 'a', role: 'link', name: 'Sign in with Google', text: 'Sign in with Google' }),
  node({ tag: 'h1', role: 'heading', name: 'Welcome back', text: 'Welcome back' }),
  node({ tag: 'select', role: 'combobox', name: 'Country', attrs: { id: 'country' } }),
];

describe('phrase similarity', () => {
  it('reads camelCase, kebab-case and punctuation alike', () => {
    assert.deepEqual(words('emailField'), ['email', 'field']);
    assert.deepEqual(words('btn-save_9f2'), ['btn', 'save', '9f2']);
    assert.equal(similarity('Sign in', 'sign in!'), 1);
    assert.ok(similarity('Save', 'Save changes') > 0.8);
    assert.ok(similarity('Save changes', 'Save') < similarity('Save', 'Save changes'));
    assert.equal(similarity('Cancel', 'Save'), 0);
  });
});

describe('finding the element a phrase means', () => {
  it('finds each control by the words a tester uses', () => {
    assert.equal(rank(page, 'Email', 'field').best?.node.attrs.id, 'emailField');
    assert.equal(rank(page, 'Password', 'field').best?.node.attrs.id, 'pw');
    assert.equal(rank(page, 'Remember me', 'checkbox').best?.node.role, 'checkbox');
    assert.equal(rank(page, 'Country', 'dropdown').best?.node.tag, 'select');
  });

  it('prefers the exact name over a longer one that contains it', () => {
    const r = rank(page, 'Sign in', 'button');
    assert.equal(r.best?.node.name, 'Sign in');
    assert.equal(r.ambiguous, false);
    assert.ok(r.confidence >= 0.95);
  });

  it('uses the control word to choose between a button and a link', () => {
    assert.equal(rank(page, 'Sign in with Google', 'link').best?.node.tag, 'a');
    assert.equal(rank(page, 'Sign in', 'link').best?.node.name, 'Sign in with Google', 'the link, when it is a link you ask for');
  });

  it('still finds an element whose label changed a little, with lower confidence', () => {
    const r = rank(page, 'Save', 'button');
    assert.equal(r.best?.node.name, 'Save changes');
    assert.ok(r.confidence < 0.95 && r.confidence > 0.7);
  });

  it('finds an element by its id when it has no visible label', () => {
    const icon = [node({ tag: 'button', role: 'button', name: '', attrs: { id: 'search-btn' } })];
    assert.equal(rank(icon, 'Search', 'button').best?.node.attrs.id, 'search-btn');
  });

  it('says it is guessing when two elements fit equally well', () => {
    const two = [node({ tag: 'button', role: 'button', name: 'Delete', text: 'Delete' }), node({ tag: 'button', role: 'button', name: 'Delete', text: 'Delete' })];
    const r = rank(two, 'Delete', 'button');
    assert.equal(r.ambiguous, true);
    assert.ok(r.confidence < 0.9);
    assert.equal(r.alternatives.length, 1);
  });

  it('returns nothing, with zero confidence, when nothing fits', () => {
    const r = rank(page, 'Checkout', 'button');
    assert.equal(r.best, undefined);
    assert.equal(r.confidence, 0);
  });

  it('does not take a text box for a button, or the other way round', () => {
    const r = rank(page, 'Email', 'button');
    assert.ok(!r.best || r.best.score < 0.7, JSON.stringify(r.best?.score));
  });

  it('for "see" steps, finds plain text and prefers the smallest element holding it', () => {
    const big = node({ tag: 'div', role: 'generic', name: 'Welcome back', text: 'Welcome back', rect: { x: 0, y: 0, w: 900, h: 600 } });
    const small = node({ tag: 'span', role: 'generic', name: 'Welcome back', text: 'Welcome back', rect: { x: 20, y: 20, w: 100, h: 20 } });
    assert.equal(rank([big, small], 'Welcome back', undefined, 'see').best?.node.tag, 'span');
  });

  it('does not call a checkbox and its wrapping label a tie', () => {
    const label = node({ tag: 'label', role: 'generic', name: 'Email me product news', text: 'Email me product news', rect: { x: 0, y: 0, w: 300, h: 30 } });
    const box = node({ tag: 'input', role: 'checkbox', name: 'Email me product news', attrs: { type: 'checkbox' }, rect: { x: 2, y: 5, w: 16, h: 16 } });
    const r = rank([label, box], 'Email me product news', 'checkbox');
    assert.equal(r.best?.node.tag, 'input');
    assert.equal(r.ambiguous, false);
  });
});
