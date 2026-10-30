Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
GREEN LIT by Balu 31 Oct 2026; building on branch `build` per BUILD-TASKS.md (main holds the scaffold only).
Done: T1 parser, T2 diary maths, T3 mock v2 (approved, plus one-tap weigh-in tweak), T4 store, T5 backup, T6 format. `npm test` 78 green.
Running (Codex Sol, base 1944f28): T7 `md-styles`, T8a `md-actions` (src/actions.js controller), T8b `md-shell` (index.html, src/app.js, src/ui stubs). Briefs in D:\Dev\codex\_briefs\.
E2E tooling ready: `e2e/` has @playwright/test 1.64.1, WebKit installed, iPhone 15 emulation verified.

## Next steps
- RESUME HERE: `cx list -Reconcile`, review and merge md-styles, md-actions, md-shell; then wave 3 screens T9 diary, T10 dictate, T11 foods (Codex), wave 4 T12 weight, T13 settings, T14 PWA; T15 install helper.
- Then T16 to T19 tests (Opus E2E in e2e/, Sonnet reviewer), T20 to T22 ship only after Balu's yes to push.
- Builder rule: Codex first; Sonnet when Codex passes 80% of its window or a job fails twice.

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
