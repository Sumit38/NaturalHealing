import type { Decision, Fingerprint, Scored, Snapshot, UINode } from './model.js';

export interface Weights {
  attr: number;
  text: number;
  tree: number;
  pos: number;
  role: number;
}

export interface Thresholds {
  /** Confidence at or above which a fix may be applied without review. */
  auto: number;
  /** Confidence below which the tool refuses and flags a human. */
  refuse: number;
  /** If the runner-up is closer than this, confidence is capped. */
  margin: number;
  /** Cap applied to confidence when the match is ambiguous (kept below `refuse`). */
  ambiguousCap: number;
  /** A candidate whose name or text is less similar than this to a named element is a different element. */
  minNameSimilarity: number;
}

export const DEFAULT_WEIGHTS: Weights = { attr: 0.2, text: 0.3, tree: 0.2, pos: 0.15, role: 0.15 };
export const DEFAULT_THRESHOLDS: Thresholds = { auto: 0.85, refuse: 0.6, margin: 0.1, ambiguousCap: 0.55, minNameSimilarity: 0.5 };

const ATTR_WEIGHT: Record<string, number> = {
  'data-testid': 3, 'data-test': 3, id: 2, name: 2, href: 2, type: 1, placeholder: 1, for: 1, title: 1,
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function textSimilarity(a: string, b: string): number {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x && !y) return 0.5; // both empty: no evidence either way
  if (!x || !y) return 0;
  if (x === y) return 1;
  const dist = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const contained = x.includes(y) || y.includes(x) ? 0.8 : 0;
  return Math.max(dist, contained);
}

function attrSimilarity(old: UINode, cand: UINode): number {
  let total = 0;
  let hit = 0;
  for (const [k, v] of Object.entries(old.attrs)) {
    const w = ATTR_WEIGHT[k] ?? 1;
    total += w;
    if (cand.attrs[k] === v) hit += w;
  }
  const a = new Set(old.classes);
  const b = new Set(cand.classes);
  if (a.size || b.size) {
    const inter = [...a].filter((c) => b.has(c)).length;
    total += 1;
    hit += inter / (a.size + b.size - inter);
  }
  return total === 0 ? 0.5 : hit / total;
}

function treeSimilarity(old: UINode, cand: UINode): number {
  const n = Math.max(old.ancestors.length, cand.ancestors.length, 1);
  let same = 0;
  for (let i = 0; i < n; i++) if (old.ancestors[i] && old.ancestors[i] === cand.ancestors[i]) same++;
  const index = 1 / (1 + Math.abs(old.siblingIndex - cand.siblingIndex));
  return 0.7 * (same / n) + 0.3 * index;
}

function posSimilarity(old: UINode, cand: UINode, fp: Fingerprint, vp: { w: number; h: number }): number {
  // Normalise by viewport so a resized window does not look like a move.
  const ax = (old.rect.x + old.rect.w / 2) / fp.viewport.w;
  const ay = (old.rect.y + old.rect.h / 2) / fp.viewport.h;
  const bx = (cand.rect.x + cand.rect.w / 2) / vp.w;
  const by = (cand.rect.y + cand.rect.h / 2) / vp.h;
  return Math.max(0, 1 - Math.hypot(ax - bx, ay - by) / 0.5);
}

export function scoreCandidate(fp: Fingerprint, cand: UINode, vp: { w: number; h: number }, w: Weights = DEFAULT_WEIGHTS): Scored {
  const old = fp.node;
  const signals = {
    attr: attrSimilarity(old, cand),
    text: Math.max(textSimilarity(old.name, cand.name), textSimilarity(old.text, cand.text)),
    tree: treeSimilarity(old, cand),
    pos: posSimilarity(old, cand, fp, vp),
    role: old.role === cand.role ? 1 : 0,
  };
  const score = w.attr * signals.attr + w.text * signals.text + w.tree * signals.tree + w.pos * signals.pos + w.role * signals.role;
  return { node: cand, score, signals };
}

export function decide(fp: Fingerprint, snap: Snapshot, w: Weights = DEFAULT_WEIGHTS, t: Thresholds = DEFAULT_THRESHOLDS): Decision {
  // Only elements with the same role are candidates; this keeps a Cancel
  // button from ever being considered for a Save text box, and so on.
  // An element that had a name is never matched to one with an unrelated
  // name: "Save" and "Cancel" are different buttons however alike they sit.
  const named = Boolean(fp.node.name || fp.node.text);
  const sameName = (n: UINode) =>
    !named || Math.max(textSimilarity(fp.node.name, n.name), textSimilarity(fp.node.text, n.text)) >= t.minNameSimilarity;
  const pool = snap.nodes.filter((n) => n.role === fp.node.role && sameName(n));
  const top = pool.map((n) => scoreCandidate(fp, n, snap.viewport, w)).sort((a, b) => b.score - a.score).slice(0, 3);
  const best = top[0];
  if (!best) return { verdict: 'refuse', confidence: 0, reason: 'No element with the same role and a similar name exists on the page.', top };
  let confidence = best.score;
  let reason = 'Single clear best match.';
  const runnerUp = top[1];
  if (runnerUp && best.score - runnerUp.score < t.margin) {
    confidence = Math.min(confidence, t.ambiguousCap);
    reason = 'Ambiguous: the runner-up scores almost as high as the best match.';
  }
  if (confidence < t.refuse) {
    return { verdict: 'refuse', confidence, reason: reason === 'Single clear best match.' ? 'Best match is below the minimum confidence.' : reason, best, top };
  }
  return { verdict: confidence >= t.auto ? 'auto' : 'suggest', confidence, reason, best, top };
}
