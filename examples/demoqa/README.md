# DemoQA text-box example

A real run of the "I have a use case" path against https://demoqa.com/text-box, a public practice site.

- `use-case.txt`: the use case as a tester would write it.
- `demoqa-text-box.xlsx`: the 14 test cases generated from it (open it in Excel; the **Basis** column says which expectations the use case states and which were guessed).

Result of running the sheet back through "I have test cases" (all 14 cases ran, none blocked):

| What | Result |
| --- | --- |
| Cases backed by the use case (main flow, invalid-email rule, alternate flow) | **3 of 3 passed** |
| Special characters in each field | 3 passed |
| Guessed expectations ("left empty" and "300 characters" must show an error) | 8 failed: DemoQA accepts those values. These are decisions for a person, not bugs, so they are not logged as bugs |
| Confidence in the results / steps understood | 88% / 93% |
| Residual risk | 23 of 100 (low) |

What the run found along the way, all fixed:

- `Open "/text-box"` (path in quotes) was read as a page *name*, so the run silently stayed on the home page.
- "Verify "X" does not appear" was read as the opposite check, and "Verify the text "X" is not visible" looked for an element called `text "X"`, which could never fail.
- DemoQA marks an invalid email with a red border and no message; the error check now accepts a field flagged as invalid (with lower confidence).
- A slow page load was reported as a failed case; it is now retried once and, if it still will not load, reported as **blocked**.
- The generator guessed that every empty or very long field should show an error. Cases now carry a Basis (Stated or Assumed).

Run it yourself: paste `use-case.txt` on the **Use cases** page, set the first page to `/text-box`, the app link to `https://demoqa.com`, and use the test data `full name=Sam Tester`, `email=sam@example.com`, `current address=1 High Street`, `permanent address=2 Low Road`.
