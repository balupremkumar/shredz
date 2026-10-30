Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
Branch `build` (main holds the scaffold only; merging to main needs Balu's yes).
Done 31 Oct 2026: `src/diary.js` (Codex Sol, 11 tests) and `src/parser.js` (Codex Sol plus one resume for joined units like "125g" and "saved", 13 tests); `npm test` green.
Mock v1 rejected as bland. Mock v2 in progress: Kove Deep Cove palette plus Cursor's design language, dark only, pill buttons (a deliberate ban-list exception Balu asked for). Dictate uses a compact live line while the keyboard is up, then a confirm screen.

## Next steps
- Check mock v2, then Phase 2: store (IndexedDB) and real screens built by Sonnet to the mock.
- Phase 3 PWA shell, icons, export/import; Phase 4 GitHub Pages after Balu's yes to push.
- Later: Balu supplies his food list for preloading.

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
