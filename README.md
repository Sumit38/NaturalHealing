# NaturalHealing

A self-healing locator engine for end-to-end tests. When a test cannot find an element because a release changed it, the engine finds the closest match on the page, retries, and proposes (or, at high confidence, applies) a fix to the test source.

This is the **Playwright MVP**: the framework-neutral engine plus one adapter, proven on a scripted bench.

## How it works

1. `healer.locate(page, selector)` replaces `page.locator(selector)`.
2. When the locator finds exactly one element, the engine saves a **fingerprint** of it (role, name, text, key attributes, class list, ancestors, sibling index, position).
3. When it finds nothing, the engine snapshots the page, keeps elements with the **same role and a similar name**, and scores each on attributes, text, tree, position and role.
4. The verdict depends on confidence (top score, capped when the runner-up is close):
   - `>= 0.85` **auto**: retry in-run; after the test passes, the selector in the source is rewritten.
   - `0.60 - 0.85` **suggest**: retry in-run, report only.
   - `< 0.60` **refuse**: the test fails normally and the report says why.
5. A heal counts only if the test then passes (`healer.finish(test, passed)`). Only lookup failures are healed; assertions are never touched.
6. The new selector is the most stable one that resolves to exactly the matched element: test id, then `role=...[name=...]`, then id, then structure.

## Run it

```sh
npm install
npm test        # needs Chromium; set up for /opt/pw-browsers
```

## Command line

```sh
npm run build
npx heal run -- npx playwright test    # run your tests; heals are recorded in .heal/
npx heal report                        # list heals, write .heal/report.html
npx heal apply --approve a1b2c3d4      # rewrite test files (auto-level heals, plus ids you approve)
npx heal pr                            # apply, commit on a branch, push, open a draft pull request
```

In your tests, use the healer in place of `page.locator`, and tell it when each test ends:

```ts
const healer = new Healer();          // reads HEAL_DIR set by `heal run`
healer.beginTest('save profile');
await (await healer.locate(page, '#saveBtn')).click();
healer.finish('save profile', passed); // in afterEach
```

When `locate` is called from a fixture or helper, pass the spec file so fixes land there: `healer.locate(page, selector, { file: testInfo.file })`. `examples/shop-app/heal-fixture.ts` shows a complete Playwright Test fixture.

Only heals whose test then passed are applied. Heals below the auto level are applied only when a person passes `--approve <id>` (ids are shown by `heal report`). `heal pr` needs `git` and, for the pull request, the GitHub CLI (`gh`); use `--no-push` or `--no-pr` to stop earlier.

## Bench result

14 scripted UI changes (renamed ids, moved or wrapped elements, link instead of button, open shadow DOM, plus cases that must not heal):

- 9 of 9 healable changes healed to the correct element, 0 false heals.
- Ambiguous (two "Save" buttons), icon-only, and removed-element cases are refused rather than guessed.
- Only 3 of the 9 reach the 0.85 auto-apply threshold; the other 6 are suggested for review. Thresholds and weights are starting values and need tuning on real suites.

The bench is a small hand-made page, not a real application. Treat the numbers as a smoke test of the algorithm, not a measured heal rate.

## Local app evaluation

`examples/shop-app` is a small local shop and bank app (login, sign-up, search, cart, transfers) with a v1 release, two later releases that change 29 elements each, and a 14-test Playwright Test suite written for v1. It shows how to wire the healer into Playwright Test with a fixture, and scores every heal against ground truth. Across both releases, 30 heals picked the right element, 2 picked the wrong one (both caught when the test then failed), and 11 cases were refused. Details, and what the run says about the 85% threshold, are in [examples/shop-app/RESULTS.md](examples/shop-app/RESULTS.md). It is a local app built for the test, not a real site.

```sh
cd examples/shop-app && ./run-eval.sh v2    # or v3
```

## Not built yet

Visual similarity, SQLite store, TypeScript syntax-tree patcher, an MCP server, other frameworks, API healing, mobile. See the architecture plan for the roadmap.
