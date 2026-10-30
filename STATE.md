Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
Feature complete and reviewed on branch `build` (31 Oct 2026); main holds the scaffold only. Not pushed, no GitHub repo yet.
Built by Codex Sol (15 jobs), reviewed and E2E-tested by Opus, Sonnet review findings fixed. Unit `npm test` 116 green; E2E `cd e2e; npx playwright test` 23 green (WebKit, iPhone 15).
Publishing is ON HOLD until Balu is home (his answer 31 Oct: "will publish when home, hold").
Install target: https://balupremkumar.github.io/macro-diary/ (QR in icons/install-qr.png, steps in README).

## Next steps
- RESUME HERE when Balu says go: `gh repo create balupremkumar/macro-diary --public --source . --push` from the project folder, merge build to main, enable Pages on main (root), then `cd e2e; $env:MD_BASE_URL='https://balupremkumar.github.io/macro-diary/'; npx playwright test` (T20, T21), then guide his install (T22).
- Later: Balu's own food list (T23) via Settings, Import backup (foods-only JSON).

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
