/**
 * ShopBank: a small local shop and bank app used to try the healer on a
 * realistic set of pages. `v1` is the release the tests were written against;
 * `v2` simulates the next release. Every element a test touches carries a
 * `data-truth` attribute naming what it is. The healer never reads that
 * attribute; the evaluation uses it to check whether a heal picked the right
 * element. CHANGES lists every difference between v1 and v2; CHANGES_V3 lists v1 to v3.
 * v3 was written after the engine fixes that v2 prompted and was run once,
 * unchanged, as a holdout.
 */
export type Version = 'v1' | 'v2' | 'v3';

/** Picks the markup for a release; v3 falls back to v1 where it did not change that part. */
const pick = (v: Version, o: { v1: string; v2: string; v3?: string }) => (v === 'v3' ? (o.v3 ?? o.v1) : o[v]);

export const CHANGES_V2: Record<string, string> = {
  'nav-cart': 'class renamed (.nav-cart -> .navbar__cart)',
  logout: 'moved into a collapsed account menu (hidden until opened)',
  'login-email': 'id renamed (#username -> #user-email)',
  'login-password': 'class changed only, id kept',
  'login-submit': 'id and class renamed, wrapped in a div, text "Log in" -> "Sign in"',
  forgot: 'text-only change ("Forgot password?" -> "Forgot your password?")',
  'signup-link': 'id renamed and text rewritten ("Create an account" -> "Join now")',
  'first-name': 'id renamed (#firstName -> #first_name)',
  'last-name': 'id renamed (#lastName -> #last_name)',
  terms: 'id removed; label now wraps the checkbox',
  newsletter: 'removed',
  'signup-submit': 'id and class renamed, same text',
  'search-input': 'id renamed (#searchBox -> #q)',
  category: 'id renamed (#category -> #cat-filter)',
  'search-submit': 'became an icon-only button with aria-label "Search"',
  'add-2': 'ids removed from all three identical "Add to cart" buttons',
  'cart-title': 'text-only change ("Your cart" -> "Shopping cart"), id kept',
  'qty-1': 'id renamed (#qty-1 -> #quantity-0)',
  'remove-2': 'link became a button',
  'coupon-input': 'id and placeholder renamed (Coupon code -> Promo code)',
  'coupon-apply': 'id renamed, and a second "Apply" button (gift card) added beside it',
  checkout: 'moved from the bottom to the top of the cart, id renamed',
  from: 'id renamed (#fromAccount -> #source-account)',
  to: 'id renamed (#toAccount -> #destination-account)',
  amount: 'id renamed (#amount -> #transfer-amount)',
  memo: 'class changed only, id kept',
  'save-payee': 'removed; a "Save draft" button now sits in its place',
  'transfer-submit': 'id replaced by a generated one (#btn-7f3a9c), class changed',
  'confirm-yes': 'id renamed and order swapped with Cancel',
};

export const CHANGES_V3: Record<string, string> = {
  'nav-cart': 'class removed, data-testid added',
  logout: 'id and text renamed ("Log out" -> "Sign out")',
  'login-email': 'id removed, label now wraps the field, name attribute kept',
  'login-password': 'id renamed (#password -> #pwd)',
  'login-submit': '<button> replaced by <input type="submit" value="Log in">, id renamed',
  'signup-link': 'id renamed and moved above the form, same text',
  'first-name': 'id renamed (#fname) and moved below Last name',
  'last-name': 'id renamed (#lname) and moved above First name',
  'signup-email': 'id renamed (#signupEmail -> #email)',
  terms: 'id renamed (#terms -> #accept-terms)',
  newsletter: 'id renamed and label rewritten ("Send me the newsletter" -> "Email me offers")',
  'signup-submit': 'id renamed, text "Create account" -> "Create my account"',
  'search-input': 'id renamed (#searchBox -> #search), placeholder "Search products" -> "Search"',
  category: 'id renamed (#category -> #categoryFilter)',
  'search-submit': 'became <input type="submit" value="Go">',
  'add-2': 'ids removed; each button gets an aria-label like "Add Leather Bag to cart"',
  'cart-title': 'id renamed (#cartTitle -> #cart-heading)',
  'qty-1': 'id now uses the product (#qty-1 -> #qty-shoe)',
  'remove-2': 'id now uses the product (#remove-2 -> #remove-bag)',
  'coupon-input': 'id renamed (#coupon -> #couponCode)',
  'coupon-apply': 'id renamed, text "Apply" -> "Apply coupon"',
  checkout: 'id renamed, text "Checkout" -> "Proceed to checkout"',
  from: 'id renamed (#from) and moved below To account',
  to: 'id renamed (#to) and moved above From account',
  amount: 'id renamed (#amt), label "Amount" -> "Amount (USD)"',
  memo: 'id renamed (#note), label "Memo" -> "Memo (optional)"',
  'save-payee': 'id renamed, text "Save payee" -> "Save as payee"',
  'transfer-submit': 'class changed only, id kept',
  'confirm-yes': 'id renamed, text "Confirm" -> "Confirm transfer"',
};

export const PRODUCTS = [
  { sku: 'shoe', name: 'Running Shoe', price: 59, category: 'Shoes' },
  { sku: 'bag', name: 'Leather Bag', price: 120, category: 'Bags' },
  { sku: 'tee', name: 'Cotton Tee', price: 18, category: 'Shirts' },
];

const css = `body{font:16px/1.4 system-ui,sans-serif;margin:0;color:#222}
header{display:flex;gap:16px;align-items:center;padding:12px 24px;background:#0b3d5c}
header a,header button{color:#fff;background:none;border:0;font:inherit;cursor:pointer;text-decoration:none}
main{max-width:860px;margin:24px auto;padding:0 24px}
label{display:block;margin-top:12px}input,select{padding:6px;font:inherit;min-width:240px}
button{padding:8px 16px;font:inherit;margin-top:12px;margin-right:8px;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{border:1px solid #ccc;padding:12px}
table{border-collapse:collapse;width:100%}td{padding:6px;border-bottom:1px solid #eee}
#menu{position:absolute;right:24px;top:48px;background:#0b3d5c;padding:8px}#confirm{border:1px solid #888;padding:12px;margin-top:12px}`;

function header(v: Version): string {
  if (v === 'v3') {
    return `<header><a class="nav-link nav-search" href="/search" data-truth="nav-search">Shop</a>
<a href="/cart" data-testid="nav-cart" data-truth="nav-cart">Cart (<span id="cartCount">0</span>)</a>
<a class="nav-link nav-transfer" href="/transfer" data-truth="nav-transfer">Transfers</a>
<span style="flex:1"></span><button id="signout" data-truth="logout">Sign out</button></header>`;
  }
  if (v === 'v1') {
    return `<header><a class="nav-link nav-search" href="/search" data-truth="nav-search">Shop</a>
<a class="nav-link nav-cart" href="/cart" data-truth="nav-cart">Cart (<span id="cartCount">0</span>)</a>
<a class="nav-link nav-transfer" href="/transfer" data-truth="nav-transfer">Transfers</a>
<span style="flex:1"></span><button id="logoutBtn" data-truth="logout">Log out</button></header>`;
  }
  return `<header><a class="navbar__item navbar__search" href="/search" data-truth="nav-search">Shop</a>
<a class="navbar__item navbar__cart" href="/cart" data-truth="nav-cart">Cart (<span id="cartCount">0</span>)</a>
<a class="navbar__item navbar__transfer" href="/transfer" data-truth="nav-transfer">Transfers</a>
<span style="flex:1"></span><button id="userMenu" aria-label="Account menu" onclick="document.getElementById('menu').hidden=!document.getElementById('menu').hidden">&#9776;</button>
<div id="menu" hidden><button class="menu-item" data-action="logout" data-truth="logout">Log out</button></div></header>`;
}

const common = `<script>
const cart = () => JSON.parse(localStorage.getItem('cart') || '[]');
const saveCart = (c) => { localStorage.setItem('cart', JSON.stringify(c)); renderCount(); };
const renderCount = () => { const el = document.getElementById('cartCount'); if (el) el.textContent = cart().reduce((n, i) => n + i.qty, 0); };
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-truth="logout"]');
  if (t) { localStorage.removeItem('user'); location.href = '/login'; }
});
</script>`;

function layout(v: Version, title: string, body: string, withHeader = true): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} - ShopBank</title><style>${css}</style>${common}</head>
<body>${withHeader ? header(v) : ''}<main>${body}</main><script>renderCount();</script></body></html>`;
}

export function login(v: Version): string {
  const body =
    v === 'v3'
      ? `<h1>Sign in to ShopBank</h1><form id="loginForm">
<label>Email <input name="username" type="email" data-truth="login-email"></label>
<label for="pwd">Password</label><input id="pwd" class="field" name="password" type="password" data-truth="login-password">
<div><input id="login" type="submit" value="Log in" class="btn btn-primary" data-truth="login-submit"></div>
<p><a href="/forgot" data-truth="forgot">Forgot password?</a></p>
<p id="loginError" role="alert"></p></form>`
      : v === 'v1'
      ? `<h1>Sign in to ShopBank</h1><form id="loginForm">
<label for="username">Email</label><input id="username" name="username" type="email" data-truth="login-email">
<label for="password">Password</label><input id="password" class="field" name="password" type="password" data-truth="login-password">
<div><button id="loginBtn" type="submit" class="btn btn-primary" data-truth="login-submit">Log in</button></div>
<p><a href="/forgot" data-truth="forgot">Forgot password?</a> &middot; <a href="/signup" id="signupLink" data-truth="signup-link">Create an account</a></p>
<p id="loginError" role="alert"></p></form>`
      : `<h1>Sign in to ShopBank</h1><form id="loginForm">
<label for="user-email">Email</label><input id="user-email" name="email" type="email" data-truth="login-email">
<label for="password">Password</label><input id="password" class="input-x91" name="password" type="password" data-truth="login-password">
<div class="form-actions"><div class="actions"><button id="signin-submit" type="submit" class="Button_primary__3kf" data-truth="login-submit">Sign in</button></div></div>
<p><a href="/forgot" data-truth="forgot">Forgot your password?</a> &middot; <a href="/signup" id="register-link" data-truth="signup-link">Join now</a></p>
<p id="loginError" role="alert"></p></form>`;
  return layout(
    v,
    'Sign in',
    (v === 'v3' ? `<p><a href="/signup" id="signup-link" data-truth="signup-link">Create an account</a></p>` : '') +
      body +
      `<script>document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const [email, pass] = [...e.target.querySelectorAll('input:not([type=submit])')].map((i) => i.value);
  if (!email || !pass) { document.getElementById('loginError').textContent = 'Enter your email and password.'; return; }
  localStorage.setItem('user', email); location.href = '/search';
});</script>`,
    false,
  );
}

export function forgot(v: Version): string {
  return layout(v, 'Reset password', `<h1>Reset your password</h1><p>We will email you a reset link.</p>`, false);
}

export function signup(v: Version): string {
  const fields =
    v === 'v3'
      ? `<label for="lname">Last name</label><input id="lname" data-truth="last-name">
<label for="fname">First name</label><input id="fname" data-truth="first-name">
<label for="email">Email</label><input id="email" type="email" data-truth="signup-email">
<div><input id="accept-terms" type="checkbox" data-truth="terms"> <label for="accept-terms" style="display:inline">I accept the terms</label></div>
<label><input id="marketing-optin" type="checkbox" data-truth="newsletter"> Email me offers</label>
<button id="register" type="submit" class="btn btn-primary" data-truth="signup-submit">Create my account</button>`
      : v === 'v1'
      ? `<label for="firstName">First name</label><input id="firstName" data-truth="first-name">
<label for="lastName">Last name</label><input id="lastName" data-truth="last-name">
<label for="signupEmail">Email</label><input id="signupEmail" type="email" data-truth="signup-email">
<div><input id="terms" type="checkbox" data-truth="terms"> <label for="terms" style="display:inline">I accept the terms</label></div>
<label><input id="newsletter" type="checkbox" data-truth="newsletter"> Send me the newsletter</label>
<button id="signupBtn" type="submit" class="btn btn-primary" data-truth="signup-submit">Create account</button>`
      : `<label for="first_name">First name</label><input id="first_name" data-truth="first-name">
<label for="last_name">Last name</label><input id="last_name" data-truth="last-name">
<label for="signupEmail">Email</label><input id="signupEmail" type="email" data-truth="signup-email">
<label><input type="checkbox" name="terms" data-truth="terms"> I accept the terms</label>
<button id="create-account" type="submit" class="Button_primary__3kf" data-truth="signup-submit">Create account</button>`;
  return layout(
    v,
    'Sign up',
    `<h1>Create your account</h1><form id="signupForm">${fields}</form><p id="signupResult" role="status"></p>
<script>document.getElementById('signupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const out = document.getElementById('signupResult');
  if (!f.querySelector('[data-truth="terms"]').checked) { out.textContent = 'Please accept the terms.'; return; }
  const nl = f.querySelector('[data-truth="newsletter"]');
  out.textContent = 'Welcome, ' + f.querySelector('[data-truth="first-name"]').value + ' ' + f.querySelector('[data-truth="last-name"]').value + '!' + (nl && nl.checked ? ' You are subscribed.' : '');
});</script>`,
    false,
  );
}

export function search(v: Version): string {
  const cards = PRODUCTS.map((p, i) =>
    v === 'v3'
      ? `<div class="card" data-sku="${p.sku}" data-category="${p.category}"><h3>${p.name}</h3><p class="price">$${p.price}</p><button class="add" aria-label="Add ${p.name} to cart" data-truth="add-${i + 1}">Add to cart</button></div>`
      : v === 'v1'
      ? `<div class="card" data-sku="${p.sku}" data-category="${p.category}"><h3>${p.name}</h3><p class="price">$${p.price}</p><button id="add-${i + 1}" class="add" data-truth="add-${i + 1}">Add to cart</button></div>`
      : `<div class="card product-card" data-sku="${p.sku}" data-category="${p.category}"><h3>${p.name}</h3><p class="price">$${p.price}</p><button class="btn add-to-cart" data-truth="add-${i + 1}">Add to cart</button></div>`,
  ).join('');
  const controls =
    v === 'v3'
      ? `<input id="search" type="search" placeholder="Search" data-truth="search-input">
<select id="categoryFilter" data-truth="category"><option value="">All categories</option><option>Shoes</option><option>Bags</option><option>Shirts</option></select>
<input type="submit" value="Go" data-truth="search-submit">`
      : v === 'v1'
      ? `<input id="searchBox" type="search" placeholder="Search products" data-truth="search-input">
<select id="category" data-truth="category"><option value="">All categories</option><option>Shoes</option><option>Bags</option><option>Shirts</option></select>
<button id="searchBtn" data-truth="search-submit">Search</button>`
      : `<input id="q" type="search" placeholder="Search products" data-truth="search-input">
<select id="cat-filter" data-truth="category"><option value="">All categories</option><option>Shoes</option><option>Bags</option><option>Shirts</option></select>
<button class="icon-btn" aria-label="Search" data-truth="search-submit">&#128269;</button>`;
  return layout(
    v,
    'Shop',
    `<h1>Shop</h1><div>${controls}</div><p id="resultCount"></p><div class="grid" id="results">${cards}</div>
<script>
const PRODUCTS = ${JSON.stringify(PRODUCTS)};
const run = () => {
  const q = document.querySelector('[data-truth="search-input"]').value.toLowerCase();
  const c = document.querySelector('[data-truth="category"]').value;
  let n = 0;
  for (const card of document.querySelectorAll('.card')) {
    const show = card.querySelector('h3').textContent.toLowerCase().includes(q) && (!c || card.dataset.category === c);
    card.hidden = !show; if (show) n++;
  }
  document.getElementById('resultCount').textContent = n + ' result' + (n === 1 ? '' : 's');
};
document.querySelector('[data-truth="search-submit"]').addEventListener('click', run);
document.getElementById('results').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const sku = b.closest('.card').dataset.sku;
  const c = cart(); const hit = c.find((i) => i.sku === sku);
  if (hit) hit.qty++; else c.push({ sku, qty: 1 });
  saveCart(c);
});
</script>`,
  );
}

export function cartPage(v: Version): string {
  const coupon =
    v === 'v3'
      ? `<div><input id="couponCode" placeholder="Coupon code" data-truth="coupon-input"><button id="apply-coupon" data-truth="coupon-apply">Apply coupon</button></div>`
      : v === 'v1'
      ? `<div><input id="coupon" placeholder="Coupon code" data-truth="coupon-input"><button id="applyCoupon" data-truth="coupon-apply">Apply</button></div>`
      : `<div><input id="promo" placeholder="Promo code" data-truth="coupon-input"><button id="coupon-apply" data-truth="coupon-apply">Apply</button></div>
<div><input id="giftcard" placeholder="Gift card number"><button id="giftcard-apply">Apply</button></div>`;
  const checkout =
    v === 'v3'
      ? `<button id="go-checkout" class="btn btn-primary" data-truth="checkout">Proceed to checkout</button>`
      : v === 'v1'
      ? `<button id="checkoutBtn" class="btn btn-primary" data-truth="checkout">Checkout</button>`
      : `<button id="proceed-checkout" class="Button_primary__3kf" data-truth="checkout">Checkout</button>`;
  const title = v === 'v2' ? 'Shopping cart' : 'Your cart';
  const row =
    v === 'v3'
      ? `'<tr data-sku="' + it.sku + '"><td>' + p.name + '</td><td><input id="qty-' + it.sku + '" type="number" min="1" value="' + it.qty + '" data-truth="qty-' + (i + 1) + '"></td><td>$' + p.price * it.qty + '</td><td><a href="#" id="remove-' + it.sku + '" class="remove" data-truth="remove-' + (i + 1) + '">Remove</a></td></tr>'`
      : v === 'v1'
      ? `'<tr data-sku="' + it.sku + '"><td>' + p.name + '</td><td><input id="qty-' + (i + 1) + '" type="number" min="1" value="' + it.qty + '" data-truth="qty-' + (i + 1) + '"></td><td>$' + p.price * it.qty + '</td><td><a href="#" id="remove-' + (i + 1) + '" class="remove" data-truth="remove-' + (i + 1) + '">Remove</a></td></tr>'`
      : `'<tr data-sku="' + it.sku + '"><td>' + p.name + '</td><td><input id="quantity-' + i + '" type="number" min="1" value="' + it.qty + '" data-truth="qty-' + (i + 1) + '"></td><td>$' + p.price * it.qty + '</td><td><button class="link-btn remove" data-truth="remove-' + (i + 1) + '">Remove</button></td></tr>'`;
  return layout(
    v,
    'Cart',
    `<h1 id="${v === 'v3' ? 'cart-heading' : 'cartTitle'}" data-truth="cart-title">${title}</h1>${v === 'v2' ? checkout : ''}
<table><tbody id="rows"></tbody></table>${coupon}<p>Total: <strong id="total"></strong></p><p id="checkoutResult" role="status"></p>${v !== 'v2' ? checkout : ''}
<script>
const PRODUCTS = ${JSON.stringify(PRODUCTS)};
let discount = 0;
const render = () => {
  const c = cart();
  document.getElementById('rows').innerHTML = c.map((it, i) => { const p = PRODUCTS.find((x) => x.sku === it.sku); return ${row}; }).join('');
  const sum = c.reduce((s, it) => s + PRODUCTS.find((x) => x.sku === it.sku).price * it.qty, 0);
  document.getElementById('total').textContent = '$' + (sum * (1 - discount)).toFixed(2);
};
document.getElementById('rows').addEventListener('change', (e) => {
  const sku = e.target.closest('tr').dataset.sku; const c = cart();
  c.find((i) => i.sku === sku).qty = Math.max(1, Number(e.target.value)); saveCart(c); render();
});
document.getElementById('rows').addEventListener('click', (e) => {
  if (!e.target.classList.contains('remove')) return;
  e.preventDefault(); const sku = e.target.closest('tr').dataset.sku; saveCart(cart().filter((i) => i.sku !== sku)); render();
});
document.querySelector('[data-truth="coupon-apply"]').addEventListener('click', () => {
  discount = document.querySelector('[data-truth="coupon-input"]').value.trim().toUpperCase() === 'SAVE10' ? 0.1 : 0; render();
});
document.querySelector('[data-truth="checkout"]').addEventListener('click', () => {
  document.getElementById('checkoutResult').textContent = 'Order placed: ' + document.getElementById('total').textContent;
});
render();
</script>`,
  );
}

export function transfer(v: Version): string {
  const accounts = `<option value="chk">Checking ••1234</option><option value="sav">Savings ••5678</option><option value="ext">Rent account ••9012</option>`;
  const form =
    v === 'v3'
      ? `<label for="to">To account</label><select id="to" data-truth="to">${accounts}</select>
<label for="from">From account</label><select id="from" data-truth="from">${accounts}</select>
<label for="amt">Amount (USD)</label><input id="amt" type="number" data-truth="amount">
<label for="note">Memo (optional)</label><input id="note" class="field" data-truth="memo">
<div><button id="save-payee" type="button" class="btn" data-truth="save-payee">Save as payee</button><button id="transferBtn" type="submit" class="btn primary-action" data-truth="transfer-submit">Send money</button></div>`
      : v === 'v1'
      ? `<label for="fromAccount">From account</label><select id="fromAccount" data-truth="from">${accounts}</select>
<label for="toAccount">To account</label><select id="toAccount" data-truth="to">${accounts}</select>
<label for="amount">Amount</label><input id="amount" type="number" data-truth="amount">
<label for="memo">Memo</label><input id="memo" class="field" data-truth="memo">
<div><button id="savePayee" type="button" class="btn" data-truth="save-payee">Save payee</button><button id="transferBtn" type="submit" class="btn btn-primary" data-truth="transfer-submit">Send money</button></div>`
      : `<label for="source-account">From account</label><select id="source-account" data-truth="from">${accounts}</select>
<label for="destination-account">To account</label><select id="destination-account" data-truth="to">${accounts}</select>
<label for="transfer-amount">Amount</label><input id="transfer-amount" type="number" data-truth="amount">
<label for="memo">Memo</label><input id="memo" class="input-x91" data-truth="memo">
<div><button id="saveDraft" type="button" class="btn" data-truth="save-draft">Save draft</button><button id="btn-7f3a9c" type="submit" class="Button_primary__3kf" data-truth="transfer-submit">Send money</button></div>`;
  const confirm =
    v === 'v3'
      ? `<button id="confirm-transfer" type="button" data-truth="confirm-yes">Confirm transfer</button><button id="confirmNo" type="button" data-truth="confirm-no">Cancel</button>`
      : v === 'v1'
      ? `<button id="confirmYes" type="button" data-truth="confirm-yes">Confirm</button><button id="confirmNo" type="button" data-truth="confirm-no">Cancel</button>`
      : `<button id="confirm-cancel" type="button" data-truth="confirm-no">Cancel</button><button id="confirm-ok" type="button" data-truth="confirm-yes">Confirm</button>`;
  return layout(
    v,
    'Transfers',
    `<h1>Transfer money</h1><form id="transferForm">${form}</form>
<div id="confirm" hidden><p id="confirmText"></p>${confirm}</div><p id="transferResult" role="status"></p>
<script>
const $ = (t) => document.querySelector('[data-truth="' + t + '"]');
const label = (sel) => sel.options[sel.selectedIndex].text;
const result = document.getElementById('transferResult');
document.getElementById('transferForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('from').value === $('to').value) { result.textContent = 'Choose two different accounts.'; return; }
  document.getElementById('confirmText').textContent = 'Send $' + $('amount').value + ' from ' + label($('from')) + ' to ' + label($('to')) + '?';
  document.getElementById('confirm').hidden = false;
});
$('confirm-yes').addEventListener('click', () => { document.getElementById('confirm').hidden = true; result.textContent = 'Sent $' + $('amount').value + ' to ' + label($('to')) + (($('memo').value) ? ' (' + $('memo').value + ')' : '') + '.'; });
$('confirm-no').addEventListener('click', () => { document.getElementById('confirm').hidden = true; result.textContent = 'Transfer cancelled.'; });
const savePayee = $('save-payee'); if (savePayee) savePayee.addEventListener('click', () => { result.textContent = 'Payee saved.'; });
const saveDraft = $('save-draft'); if (saveDraft) saveDraft.addEventListener('click', () => { result.textContent = 'Draft saved.'; });
</script>`,
  );
}
