Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
LIVE 31 Oct 2026: https://balupremkumar.github.io/shredz/ (public repo balupremkumar/shredz, GitHub Pages from main). v0.2.0.
E2E against the live site: 32 green (WebKit, iPhone 15). Unit 141 green. Commits use the GitHub no-reply email (history rewritten before first push; local tag pre-publish-backup holds the old history).
Balu's 13 NZ foods: private/macro-diary-foods.json (git-ignored, never pushed); estimates to check in private/foods-research.md.

## Next steps
- Balu installs from the QR (Safari, Share, Add to Home Screen), imports the foods file (Settings, Import backup, Merge), sets goals, optionally turns on the weigh-in badge in Settings.
- Releases: bump APP_VERSION in src/version.js and VERSION in sw.js together, run unit + E2E, push main; installed phones update on the next open.
- Ideas not picked: BACKLOG.md.

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
