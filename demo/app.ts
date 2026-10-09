/** A small profile page used as the system under test. Variants model the UI changes a release can bring. */
export const BASE_SAVE = '<button id="saveBtn" class="btn primary" data-x="save">Save</button>';

export function page(save: string = BASE_SAVE, extras = ''): string {
  return `<!doctype html><meta charset="utf-8"><style>body{font:16px sans-serif;margin:24px}.btn{padding:8px 16px;margin-right:8px}</style>
<nav><a id="navHome" href="/">Home</a> <a id="navSettings" href="/settings">Settings</a></nav>
<main><h1>Profile</h1>${extras}
<form id="profile"><label for="email">Email</label>
<input id="email" type="email" placeholder="Email address" data-x="email">
<div class="actions">${save}<button id="cancelBtn" class="btn" data-x="cancel">Cancel</button><button id="deleteBtn" class="btn danger" data-x="delete">Delete account</button></div></form></main>`;
}

export const SHADOW_SAVE = (btn: string) =>
  `<div id="host"></div><script>document.getElementById('host').attachShadow({mode:'open'}).innerHTML=${JSON.stringify(btn)};</script>`;
