Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
Feature complete on branch `build` (31 Oct 2026); main holds the scaffold only. Not pushed, no GitHub repo yet.
Built by Codex Sol (14 jobs), reviewed and E2E-tested by Opus; polish fixes by Opus. Unit `npm test` 92 green; E2E `cd e2e; npx playwright test` 23 green (WebKit, iPhone 15).
Sonnet review 31 Oct: 1 high (non-atomic import), fixes running as Codex job `md-review-fix`.
Install target: https://balupremkumar.github.io/macro-diary/ (QR in icons/install-qr.png, steps in README).

## Next steps
- RESUME HERE: merge `md-review-fix` after reading its diff, rerun unit + E2E.
- Ask Balu's yes to: create public repo balupremkumar/macro-diary, push, enable Pages, merge build to main (T20). Then E2E against live URL with MD_BASE_URL (T21), then Balu installs (T22).
- Later: Balu's own food list (T23) via Settings, Import backup (foods-only JSON).

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
