Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
Feature complete and reviewed on branch `build` (31 Oct 2026); main holds the scaffold only. Not pushed, no GitHub repo yet.
Built by Codex Sol (15 jobs), reviewed and E2E-tested by Opus, Sonnet review findings fixed. Unit `npm test` 116 green; E2E `cd e2e; npx playwright test` 23 green (WebKit, iPhone 15).
Publishing is ON HOLD until Balu is home (his answer 31 Oct: "will publish when home, hold").
Install target: https://balupremkumar.github.io/macro-diary/ (QR in icons/install-qr.png, steps in README).

## Next steps
- v1.1 GREEN LIT 31 Oct (BUILD-TASKS.md "v1.1 quality of life", Q1 to Q13). Wave 1 running on Codex (base b28ba62): md-v11-data (store v2, savedMeals, settings, backup schema 2), md-v11-parser (saved meal names), md-v11-insights (new src/insights.js).
- RESUME HERE: merge wave 1, then wave 2 actions.js (saved meals CRUD, addAlias, goal modes, select.recentFoods, select.report, CSV, stepQty), then wave 3 UI (diary.js + styles.css; dictate.js; settings.js + weight.js), then Opus: app.js (large-text class, setAppBadge via insights.needsWeighIn), sw.js FILES + src/insights.js, VERSION 0.2.0 in sw.js and src/version.js, new E2E specs, Sonnet review of the v1.1 diff.
- Publishing ON HOLD until Balu is home; then T20 to T22 as below. Foods file ready: private/macro-diary-foods.json (13 foods, git-ignored), Balu imports with Settings, Import backup, Merge.
- T20 when Balu says go: `gh repo create balupremkumar/macro-diary --public --source . --push`, merge build to main, enable Pages on main (root), E2E with MD_BASE_URL, guide install.

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
