/** Framework-neutral description of one UI element (the "UI node model"). */
export interface UINode {
  tag: string;
  role: string;
  /** Accessible name (aria-label, label text, placeholder, or visible text). */
  name: string;
  /** Visible text, trimmed and whitespace-collapsed. */
  text: string;
  attrs: Record<string, string>;
  classes: string[];
  /** Tag names of up to three ancestors, nearest first. */
  ancestors: string[];
  siblingIndex: number;
  rect: { x: number; y: number; w: number; h: number };
  /** Selector built from structure only; works across open shadow roots. */
  cssPath: string;
}

export interface Viewport {
  w: number;
  h: number;
}

export interface Snapshot {
  viewport: Viewport;
  nodes: UINode[];
}

export interface Fingerprint {
  node: UINode;
  viewport: Viewport;
  selector: string;
}

export interface Scored {
  node: UINode;
  score: number;
  signals: { attr: number; text: number; tree: number; pos: number; role: number };
}

export type Verdict = 'auto' | 'suggest' | 'refuse';

export interface Decision {
  verdict: Verdict;
  confidence: number;
  reason: string;
  best?: Scored;
  top: Scored[];
}
