# Healing on a local shop and bank app

**This is a local app I built for the test, served from `127.0.0.1`, not a real website.** Outside sites were blocked from the test environment, so this checks the engine on realistic pages and a realistic Playwright Test suite, but the app, its releases and the suite were all written by the same author as the tool. Treat the numbers as an honest smoke test, not a measured heal rate for your product.

## Setup

- **ShopBank** (`server.ts`, `pages.ts`): login, sign-up, product search, cart with coupon and checkout, and a bank transfer with a confirm step.
- **v1** is the release the suite was written for. **v2** and **v3** are two later releases, each with 29 element changes from v1: renamed or generated ids, changed classes, moved or wrapped buttons, text-only changes, removed elements, duplicate-looking buttons, link-to-button swaps, reordered fields, icon-only buttons. Every change is listed in `CHANGES_V2` and `CHANGES_V3`.
- **Suite:** 14 Playwright Test cases, 30 element lookups (`tests/`). The healer is wired in through a fixture (`heal-fixture.ts`). It passes 14 of 14 on v1.
- **Ground truth:** every element carries a `data-truth` attribute. The healer never reads it; the scorer (`evaluate.ts`) uses it to check whether each heal picked the intended element.
- **Order of work:** v2 was run first and exposed two engine bugs, which I fixed. v3 was written after those fixes and run once, unchanged, as a holdout, so its numbers are the unbiased ones.

Reproduce with `./run-eval.sh v2` or `./run-eval.sh v3` (needs Chromium; nothing is written to the test files).

## Results

| | v2, before fixes | v2, after fixes | v3 holdout |
| --- | --- | --- | --- |
| Tests passing without healing | 0 of 14 | 0 of 14 | 1 of 14 |
| Tests passing with healing | 6 of 14 | 6 of 14 | 7 of 14 |
| Lookups that needed no heal | 3 | 4 | 1 |
| Healed to the correct element | 11 | 17 | 13 |
| Healed to the **wrong** element, test then failed | 1 | 1 | 1 |
| Healed to the **wrong** element, test still passed | **1** | 0 | 0 |
| Refused, element really gone or hidden | 1 | 2 | 0 |
| Refused although the element was there (missed) | 6 | 5 | 6 |
| Not reached (test failed earlier) | 7 | 1 | 9 |

Of the heals the engine attempted after the fixes (both releases), **30 were correct and 2 were wrong**. Both wrong heals were caught because the test's own assertion then failed, so neither would be applied. Every refusal was a safe failure: the test failed as it would have without the tool.

`heal apply --min-confidence 0.6` on the v2 run rewrote 16 locators across 5 spec files. Re-running v2 with the patched specs, the 6 previously healed tests passed with **no healing needed**; the remaining 8 failures are the cases below that need a person.

### What went wrong, and what it shows

- **A removed checkbox was "healed" to a different checkbox and the test still passed (v2, before the fix).** The newsletter opt-in was removed; the engine matched it to the terms checkbox, the test ticked it, asserted it was ticked, and went green. Cause: a checkbox whose label wraps it had no name, and unnamed elements skipped the name check. **Fixed:** wrapping labels now name the control. This is the most important finding: the "test then passed" check cannot catch a wrong heal when the test's assertions only look at the element itself.
- **Inputs were never filtered by name (v2, before the fix).** When two elements both had no inner text, the name check scored 0.5 "no evidence" and let every same-role field through, so From and To account looked equally good. **Fixed:** the accessible name decides when the old element had one; a field's typed value and a select's option list no longer count as its name. After the fix, From and To healed correctly.
- **"Save payee" was removed and matched to "Save draft" (v2, 0.75).** The names are 60% alike by edit distance. The test's "Payee saved" assertion failed, so it was caught.
- **"Add to cart" buttons got per-product labels (v3, 0.65).** "Add to cart" healed to "Add Cotton Tee to cart" instead of "Add Leather Bag to cart", because edit distance favours the shorter label. The cart assertion caught it. Edit distance on names is the weakest part of the engine.

### What it refused (missed heals)

- **Look-alike neighbours:** quantity fields in two cart rows, two "Apply" buttons (coupon and gift card), three identical "Add to cart" buttons, and in v3 First/Last name and From/To account after they were **swapped in order**. The engine refuses when the runner-up is too close. That is safe, but the swapped-order case blocked two whole tests. Using nearby text (the product name in the row, the label above) would resolve most of these.
- **Role changed:** a Remove link that became a button. Candidates must keep their role, by design.
- **Text fully rewritten:** "Create an account" to "Join now", "Search" to "Go", "Send me the newsletter" to "Email me offers".
- **Hidden behind a new step:** Log out moved into a collapsed menu. No locator fix can work; the test needs a new click.

One miss can also block good heals: in v3 the search test failed on the refused "Go" button, so the two correct heals earlier in that test were marked failed-verification and not applied.

## Is 85% the right auto-apply threshold?

| Threshold | Correct heals at or above (v2 + v3, 30 total) | Wrong heals at or above (2 total) |
| --- | --- | --- |
| 0.65 | 28 | 1 |
| 0.70 | 25 | 1 |
| 0.75 | 23 | 0 |
| 0.80 | 19 | 0 |
| **0.85** | **7** | **0** |
| 0.90 | 3 | 0 |

- **85% is safe here but too strict.** It auto-applied no wrong heal, but only 7 of 30 correct heals reached it.
- **The main reason is structural, not the number.** When an element's id is renamed and nothing else changes, the attribute signal drops to 0 and the score tops out at exactly 0.80 (text 0.30 + structure 0.20 + position 0.15 + role 0.15). With the current weights, the most common release change can never be auto-applied at 85%. That is why so many correct heals sit at exactly 0.80.
- **0.80 would have auto-applied 19 of 30 with no wrong heals**, but the highest wrong heal was 0.75, a margin of only 0.05 on 32 data points from an app I built. That is not enough evidence to lower it.
- **Recommendation:** keep 85% as the default for now, and run in suggest mode on a real suite, recording approvals per confidence band. If approvals at 0.80 to 0.85 are near 100%, either lower the threshold to 0.80 or reweight so a clean id rename lands above 0.85. Separately, the "test passed" check should not be the only guard for removed elements, since the newsletter case shows it can pass on the wrong element.

## Per-lookup detail

### ShopBank v1 -> v2

| Test | Locator | Element | Outcome | Verdict | Confidence | Test after heal | New locator |
| --- | --- | --- | --- | --- | --- | --- | --- |
| change the quantity of an item | `#qty-1` | qty-1 | refused, element was there | refuse | 0.55 | refused | - |
| remove an item | `#remove-2` | remove-2 | refused, element was there | refuse | 0.00 | refused | - |
| apply a coupon | `#coupon` | coupon-input | healed correctly | suggest | 0.63 | failed-verification | `role=textbox[name="Promo code"s]` |
| apply a coupon | `#applyCoupon` | coupon-apply | refused, element was there | refuse | 0.55 | refused | - |
| check out | `#cartTitle` | cart-title | no heal needed | - | - | - | - |
| check out | `#checkoutBtn` | checkout | healed correctly | suggest | 0.66 | verified | `role=button[name="Checkout"s]` |
| log in with email and password | `#username` | login-email | healed correctly | suggest | 0.84 | verified | `role=textbox[name="Email"s]` |
| log in with email and password | `#password` | login-password | no heal needed | - | - | - | - |
| log in with email and password | `#loginBtn` | login-submit | healed correctly | suggest | 0.63 | verified | `role=button[name="Sign in"s]` |
| open the forgot password page | `text=Forgot password?` | forgot | healed correctly | auto | 0.92 | verified | `role=link[name="Forgot your password?"s]` |
| go to sign up from the login page | `#signupLink` | signup-link | refused, element was there | refuse | 0.00 | refused | - |
| search by name and category | `#searchBox` | search-input | healed correctly | auto | 0.90 | verified | `role=searchbox[name="Search products"s]` |
| search by name and category | `#category` | category | healed correctly | suggest | 0.80 | verified | `#cat-filter` |
| search by name and category | `#searchBtn` | search-submit | healed correctly | suggest | 0.80 | verified | `role=button[name="Search"s]` |
| add the second product to the cart | `#add-2` | add-2 | refused, element was there | refuse | 0.55 | refused | - |
| add the second product to the cart | `.nav-cart` | nav-cart | not reached | - | - | - | - |
| log out | `#logoutBtn` | logout | refused, element gone | refuse | 0.00 | refused | - |
| sign up a new customer | `#firstName` | first-name | healed correctly | suggest | 0.80 | verified | `role=textbox[name="First name"s]` |
| sign up a new customer | `#lastName` | last-name | healed correctly | suggest | 0.80 | verified | `role=textbox[name="Last name"s]` |
| sign up a new customer | `#signupEmail` | signup-email | no heal needed | - | - | - | - |
| sign up a new customer | `#terms` | terms | healed correctly | suggest | 0.82 | verified | `role=checkbox[name="I accept the terms"s]` |
| sign up a new customer | `#signupBtn` | signup-submit | healed correctly | suggest | 0.81 | verified | `role=button[name="Create account"s]` |
| opt in to the newsletter | `#newsletter` | newsletter | refused, element gone | refuse | 0.00 | refused | - |
| send money between accounts | `#fromAccount` | from | healed correctly | suggest | 0.80 | verified | `role=combobox[name="From account"s]` |
| send money between accounts | `#toAccount` | to | healed correctly | suggest | 0.80 | verified | `role=combobox[name="To account"s]` |
| send money between accounts | `#amount` | amount | healed correctly | auto | 0.87 | verified | `#transfer-amount` |
| send money between accounts | `#memo` | memo | no heal needed | - | - | - | - |
| send money between accounts | `#transferBtn` | transfer-submit | healed correctly | suggest | 0.85 | verified | `role=button[name="Send money"s]` |
| send money between accounts | `#confirmYes` | confirm-yes | healed correctly | suggest | 0.81 | verified | `role=button[name="Confirm"s]` |
| save a payee | `#savePayee` | save-payee | WRONG heal, test failed | suggest | 0.75 | failed-verification | `role=button[name="Save draft"s]` |

**30 lookups:** no heal needed 4, healed correctly 17, WRONG heal, test failed 1, WRONG heal, test passed 0, refused, element gone 2, refused, element was there 5, not reached 1.

Auto-apply threshold sweep (heals the engine attempted; "wrong" means it picked a different element):

| Threshold | Correct heals at or above | Wrong heals at or above |
| --- | --- | --- |
| 0.60 | 17 of 17 | 1 of 1 |
| 0.65 | 15 of 17 | 1 of 1 |
| 0.70 | 14 of 17 | 1 of 1 |
| 0.75 | 14 of 17 | 0 of 1 |
| 0.80 | 13 of 17 | 0 of 1 |
| 0.85 | 3 of 17 | 0 of 1 |
| 0.90 | 2 of 17 | 0 of 1 |

Correct heal confidences: 0.63, 0.63, 0.66, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.81, 0.81, 0.82, 0.84, 0.85, 0.87, 0.90, 0.92. Wrong heal confidences: 0.75.


### ShopBank v1 -> v3

| Test | Locator | Element | Outcome | Verdict | Confidence | Test after heal | New locator |
| --- | --- | --- | --- | --- | --- | --- | --- |
| change the quantity of an item | `#qty-1` | qty-1 | refused, element was there | refuse | 0.55 | refused | - |
| remove an item | `#remove-2` | remove-2 | refused, element was there | refuse | 0.55 | refused | - |
| apply a coupon | `#coupon` | coupon-input | healed correctly | auto | 0.87 | verified | `role=textbox[name="Coupon code"s]` |
| apply a coupon | `#applyCoupon` | coupon-apply | healed correctly | suggest | 0.73 | verified | `role=button[name="Apply coupon"s]` |
| check out | `#cartTitle` | cart-title | healed correctly | suggest | 0.80 | verified | `role=heading[name="Your cart"s]` |
| check out | `#checkoutBtn` | checkout | healed correctly | suggest | 0.80 | verified | `role=button[name="Proceed to checkout"s]` |
| log in with email and password | `#username` | login-email | healed correctly | suggest | 0.74 | verified | `role=textbox[name="Email"s]` |
| log in with email and password | `#password` | login-password | healed correctly | auto | 0.89 | verified | `role=textbox[name="Password"s]` |
| log in with email and password | `#loginBtn` | login-submit | healed correctly | auto | 0.88 | verified | `role=button[name="Log in"s]` |
| open the forgot password page | `text=Forgot password?` | forgot | no heal needed | - | - | - | - |
| go to sign up from the login page | `#signupLink` | signup-link | healed correctly | suggest | 0.66 | verified | `role=link[name="Create an account"s]` |
| search by name and category | `#searchBox` | search-input | healed correctly | suggest | 0.78 | failed-verification | `role=searchbox[name="Search"s]` |
| search by name and category | `#category` | category | healed correctly | suggest | 0.79 | failed-verification | `#categoryFilter` |
| search by name and category | `#searchBtn` | search-submit | refused, element was there | refuse | 0.00 | refused | - |
| add the second product to the cart | `#add-2` | add-2 | WRONG heal, test failed | suggest | 0.65 | failed-verification | `role=button[name="Add Cotton Tee to cart"s]` |
| add the second product to the cart | `.nav-cart` | nav-cart | healed correctly | auto | 0.93 | failed-verification | `[data-testid="nav-cart"]` |
| log out | `#logoutBtn` | logout | healed correctly | suggest | 0.69 | verified | `role=button[name="Sign out"s]` |
| sign up a new customer | `#firstName` | first-name | refused, element was there | refuse | 0.55 | refused | - |
| sign up a new customer | `#lastName` | last-name | not reached | - | - | - | - |
| sign up a new customer | `#signupEmail` | signup-email | not reached | - | - | - | - |
| sign up a new customer | `#terms` | terms | not reached | - | - | - | - |
| sign up a new customer | `#signupBtn` | signup-submit | not reached | - | - | - | - |
| opt in to the newsletter | `#newsletter` | newsletter | refused, element was there | refuse | 0.00 | refused | - |
| send money between accounts | `#fromAccount` | from | refused, element was there | refuse | 0.55 | refused | - |
| send money between accounts | `#toAccount` | to | not reached | - | - | - | - |
| send money between accounts | `#amount` | amount | not reached | - | - | - | - |
| send money between accounts | `#memo` | memo | not reached | - | - | - | - |
| send money between accounts | `#transferBtn` | transfer-submit | not reached | - | - | - | - |
| send money between accounts | `#confirmYes` | confirm-yes | not reached | - | - | - | - |
| save a payee | `#savePayee` | save-payee | healed correctly | suggest | 0.83 | verified | `role=button[name="Save as payee"s]` |

**30 lookups:** no heal needed 1, healed correctly 13, WRONG heal, test failed 1, WRONG heal, test passed 0, refused, element gone 0, refused, element was there 6, not reached 9.

Auto-apply threshold sweep (heals the engine attempted; "wrong" means it picked a different element):

| Threshold | Correct heals at or above | Wrong heals at or above |
| --- | --- | --- |
| 0.60 | 13 of 13 | 1 of 1 |
| 0.65 | 13 of 13 | 0 of 1 |
| 0.70 | 11 of 13 | 0 of 1 |
| 0.75 | 9 of 13 | 0 of 1 |
| 0.80 | 6 of 13 | 0 of 1 |
| 0.85 | 4 of 13 | 0 of 1 |
| 0.90 | 1 of 13 | 0 of 1 |

Correct heal confidences: 0.66, 0.69, 0.73, 0.74, 0.78, 0.79, 0.80, 0.80, 0.83, 0.87, 0.88, 0.89, 0.93. Wrong heal confidences: 0.65.

