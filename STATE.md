Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
v0.2.0 (v1 plus v1.1 quality of life) complete on branch `build`, 31 Oct 2026; main holds the scaffold only. Not pushed, no GitHub repo yet.
v1 built by Codex Sol; v1.1 built by Sonnet after Codex hit its 80% usage guard; Opus briefs, reviews, E2E and polish. Two Sonnet reviews, all confirmed findings fixed.
Unit `npm test` 141 green; E2E `cd e2e; npx playwright test` 32 green (WebKit, iPhone 15).
Balu's 13 NZ foods: private/macro-diary-foods.json (git-ignored), import verified in WebKit; values and sources in private/foods-research.md (rice cake weight, toast slice weight and Scorpion whey are estimates to check).
Publishing ON HOLD until Balu is home.

## Next steps
- RESUME HERE when Balu says go: `gh repo create balupremkumar/macro-diary --public --source . --push` from the project folder, merge build to main, enable Pages on main (root), then `cd e2e; $env:MD_BASE_URL='https://balupremkumar.github.io/macro-diary/'; npx playwright test`, then guide install and the food import (email the JSON to himself, Save to Files, Settings, Import backup, Merge).
- Ideas not picked: BACKLOG.md.

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
