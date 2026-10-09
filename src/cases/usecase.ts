/** Reads a use case written in ordinary prose into the parts a test designer needs. */

export interface UseCase {
  title: string;
  actor?: string;
  preconditions: string[];
  mainFlow: string[];
  alternates: string[];
  rules: string[];
  postconditions: string[];
  /** Given / When / Then scenarios from acceptance criteria. */
  scenarios: { name: string; given: string[]; when: string[]; then: string[] }[];
}

type Section = 'title' | 'actor' | 'pre' | 'main' | 'alt' | 'rules' | 'post' | 'accept' | 'description';

const HEADINGS: [RegExp, Section][] = [
  [/^(?:use ?case|uc|user story|story|feature|scenario)\b[\s\w#.-]*?[:\-–]\s*(.*)$/i, 'title'],
  [/^(?:primary\s+|main\s+)?actors?\s*[:\-–]\s*(.*)$/i, 'actor'],
  [/^(?:as an?|as the)\s+(.+?)(?:,|\s+i\s+(?:want|can|need|would))/i, 'actor'],
  [/^pre-?conditions?\s*[:\-–]?\s*(.*)$/i, 'pre'],
  [/^(?:prerequisites?|assumptions?)\s*[:\-–]?\s*(.*)$/i, 'pre'],
  [/^(?:main|basic|normal|happy|primary|success)(?:\s+success)?(?:\s+(?:flow|scenario|path|course))?(?:\s+of events)?\s*[:\-–]?\s*(.*)$/i, 'main'],
  [/^(?:steps?|flow(?: of events)?|procedure|description of flow)\s*[:\-–]?\s*(.*)$/i, 'main'],
  [/^(?:alternate|alternative|alt|exception|exceptional|extension|error|failure|negative)s?(?:\s+(?:flows?|scenarios?|paths?|courses?|cases?))?\s*[:\-–]?\s*(.*)$/i, 'alt'],
  [/^(?:business\s+)?(?:rules?|constraints?|validations?|validation rules?|requirements?|non-functional)\s*[:\-–]?\s*(.*)$/i, 'rules'],
  [/^(?:post-?conditions?|outcome|expected(?: result)?|success (?:guarantee|criteria)|result)\s*[:\-–]?\s*(.*)$/i, 'post'],
  [/^(?:acceptance criteria|acceptance tests?|criteria)\s*[:\-–]?\s*(.*)$/i, 'accept'],
  [/^(?:description|summary|overview|goal|purpose)\s*[:\-–]?\s*(.*)$/i, 'description'],
];

const ITEM = /^\s*(?:(?:step\s*)?\d+[a-z]?[.):]|[a-z]\d+[.):]|\d+\.\d+[.)]?|[-*•–]|[a-z][.)])\s+/i;

export function parseUseCase(text: string): UseCase {
  const uc: UseCase = { title: '', preconditions: [], mainFlow: [], alternates: [], rules: [], postconditions: [], scenarios: [] };
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trimEnd());
  let section: Section | undefined;
  const loose: string[] = [];
  let gwt: UseCase['scenarios'][number] | undefined;
  let gwtPart: 'given' | 'when' | 'then' = 'given';

  const push = (to: Section | undefined, item: string) => {
    const t = item.trim();
    if (!t) return;
    if (to === 'pre') uc.preconditions.push(t);
    else if (to === 'main') uc.mainFlow.push(t);
    else if (to === 'alt') uc.alternates.push(t);
    else if (to === 'rules') uc.rules.push(t);
    else if (to === 'post') uc.postconditions.push(t);
    else if (to === 'actor' && !uc.actor) uc.actor = t;
    else loose.push(t);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Given / When / Then
    const g = line.match(/^(given|when|then|and|but)\b[\s:,-]*(.*)$/i);
    if (g && (section === 'accept' || gwt || /^(given|when|then)\b/i.test(line))) {
      const kw = g[1].toLowerCase();
      if (kw === 'given' && (!gwt || gwt.when.length || gwt.then.length)) {
        gwt = { name: `Scenario ${uc.scenarios.length + 1}`, given: [], when: [], then: [] };
        uc.scenarios.push(gwt);
      }
      if (!gwt) {
        gwt = { name: `Scenario ${uc.scenarios.length + 1}`, given: [], when: [], then: [] };
        uc.scenarios.push(gwt);
      }
      if (kw === 'given' || kw === 'when' || kw === 'then') gwtPart = kw;
      gwt[gwtPart].push(g[2].trim());
      continue;
    }
    const named = line.match(/^scenario\s*:?\s*(.+)$/i);
    if (named && section === 'accept') {
      gwt = { name: named[1].trim(), given: [], when: [], then: [] };
      uc.scenarios.push(gwt);
      gwtPart = 'given';
      continue;
    }

    // A heading, possibly with content after the colon.
    let matched = false;
    for (const [re, kind] of HEADINGS) {
      const h = line.replace(ITEM, '').match(re);
      // Headings are short lines; a long sentence that happens to start with "main" is content.
      if (h && (line.endsWith(':') || line.length < 70 || h[1] !== undefined) && !(ITEM.test(line) && kind !== 'title' && kind !== 'actor' && !line.endsWith(':'))) {
        matched = true;
        if (kind === 'title') {
          if (!uc.title) uc.title = (h[1] || '').trim();
          section = 'title';
        } else if (kind === 'actor' && re.source.startsWith('^(?:as')) {
          uc.actor = uc.actor ?? h[1].trim();
          loose.push(line);
        } else {
          section = kind;
          if (h[1]?.trim()) push(kind === 'accept' || kind === 'description' ? undefined : kind, h[1]);
          if (kind === 'accept') gwt = undefined;
        }
        break;
      }
    }
    if (matched) continue;
    push(section, line.replace(ITEM, ''));
  }

  if (!uc.title) uc.title = (loose[0] ?? uc.mainFlow[0] ?? 'Use case').replace(/[.:]+$/, '').slice(0, 80);
  // No headings at all: treat the sentences as the main flow.
  if (!uc.mainFlow.length && !uc.scenarios.length) {
    const sentences = (loose.length ? loose : lines.filter(Boolean)).flatMap((l) => l.split(/(?<=[.;])\s+/)).map((s) => s.replace(/[.;]$/, '').trim()).filter(Boolean);
    uc.mainFlow = uc.title && sentences[0]?.startsWith(uc.title) ? sentences.slice(1) : sentences;
  }
  return uc;
}
