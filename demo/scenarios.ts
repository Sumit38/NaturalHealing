/** UI changes a release can bring, shared by the Playwright and Selenium benches. */
import { BASE_SAVE, SHADOW_SAVE, page as app } from './app.js';

export type Expect = 'heal' | 'untouched' | 'not-auto';
export interface Scenario {
  name: string;
  selector: string;
  /** Page before and after the release. */
  before: string;
  after: string;
  expect: Expect;
  target?: string;
}

const renamed = '<button id="coloredButton" class="btn primary" data-x="save">Save</button>';
export const scenarios: Scenario[] = [
  { name: 'id renamed, same text (the Save button case)', selector: '#saveBtn', before: app(), after: app(renamed), expect: 'heal', target: 'save' },
  { name: 'class changed only, id kept', selector: '#saveBtn', before: app(), after: app(BASE_SAVE.replace('btn primary', 'x9f3a')), expect: 'untouched' },
  { name: 'text changed, id kept', selector: '#saveBtn', before: app(), after: app(BASE_SAVE.replace('>Save<', '>Save changes<')), expect: 'untouched' },
  { name: 'id renamed and text changed', selector: '#saveBtn', before: app(), after: app('<button id="b1" class="btn primary" data-x="save">Save changes</button>'), expect: 'heal', target: 'save' },
  { name: 'moved into a different container', selector: '#saveBtn', before: app(), after: app('', '<div class="toolbar"><button id="b1" class="btn primary" data-x="save">Save</button></div>'), expect: 'heal', target: 'save' },
  { name: 'wrapped in an extra div', selector: '#saveBtn', before: app(), after: app('<div class="wrap">' + renamed + '</div>'), expect: 'heal', target: 'save' },
  { name: 'id removed, class randomised', selector: '#saveBtn', before: app(), after: app('<button class="css-1x2y3z" data-x="save">Save</button>'), expect: 'heal', target: 'save' },
  { name: 'button became a link with role=button', selector: '#saveBtn', before: app(), after: app('<a role="button" id="b1" href="#" class="btn primary" data-x="save">Save</a>'), expect: 'heal', target: 'save' },
  { name: 'text input id renamed', selector: '#email', before: app(), after: app().replace('id="email"', 'id="emailAddress"'), expect: 'heal', target: 'email' },
  { name: 'Save and Cancel swapped, id renamed', selector: '#saveBtn', before: app(), after: app('').replace('<button id="cancelBtn"', renamed + '<button id="cancelBtn"').replace(renamed + '<button id="cancelBtn" class="btn" data-x="cancel">Cancel</button>', '<button id="cancelBtn" class="btn" data-x="cancel">Cancel</button>' + renamed), expect: 'heal', target: 'save' },
  { name: 'open shadow DOM, id renamed', selector: '#saveBtn', before: app('', SHADOW_SAVE(BASE_SAVE)), after: app('', SHADOW_SAVE(renamed)), expect: 'heal', target: 'save' },
  { name: 'icon-only button, id renamed', selector: '#saveBtn', before: app(), after: app('<button id="b1" class="btn primary" data-x="save">\u{1F4BE}</button>'), expect: 'not-auto' },
  { name: 'two Save buttons appear (ambiguous)', selector: '#saveBtn', before: app(), after: app('<button id="b1" class="btn primary" data-x="save">Save</button><button id="b2" class="btn primary" data-x="save2">Save</button>'), expect: 'not-auto' },
  { name: 'Save button removed entirely', selector: '#saveBtn', before: app(), after: app(''), expect: 'not-auto' },
];
