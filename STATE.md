Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
LIVE 31 Oct 2026: https://balupremkumar.github.io/shredz/ (public repo balupremkumar/shredz, GitHub Pages from main). v0.2.0.
E2E against the live site: 32 green (WebKit, iPhone 15). Unit 141 green. Commits use the GitHub no-reply email (history rewritten before first push; local tag pre-publish-backup holds the old history).
Balu's 13 NZ foods: private/macro-diary-foods.json (git-ignored, never pushed); estimates to check in private/foods-research.md.

## Next steps
- RESUME HERE (paused 31 Oct 2026 for a PC restart, mid-way through v2 decision questions): Balu installed Shredz on his iPhone and wants a v2 overhaul. Finish the questions, show the plan and a mock, get his yes, then build.
- v2 decisions LOCKED (Balu, 31 Oct):
  - Style: Apple Health / iOS native (grouped lists, edge-to-edge rows, subtle dividers, few boxes). He called v0.2 "bubbly", "cramped", "misaligned", "amateur"; fix spacing, hierarchy and alignment so the eye goes where it should.
  - Theme: follow the iPhone light/dark setting.
  - Logo: Kove mark as the home-screen icon; in-app header shows the Kove mark plus the word "Shredz" in the Kove typeface (assets in D:\Devi\design-system).
  - Onboarding: 3-step welcome on first open (set goals, check foods, try a dictation).
  - Dictation UX: big in-app mic button (iPhone speech recognition where it works) with automatic keyboard-mic fallback, live "I heard" list.
  - Dictation accuracy: real failure, verbatim: "Weet-Bix, 3 servings," then "Chicken breast, 100 grams," gave "Chicken breast x 100 grams" (the amount was mis-bound). "100 grams of chicken breast" must equal "chicken breast 100 grams"; "servings" must count. Balu suggests learning his speech patterns from Quiett (D:\Devi\projectsctive\quiett, and memory dictation-profile.md) to build a test corpus.
  - Nutrition: Claude validates every value itself online (no label photos), aiming for the most commonly used AU/NZ values (MyFitnessPal's sources, FSANZ AUSNUT, NZ FOODfiles, brand pages), cross-checked across sources. Basmati cooked (boiled, absorption), chicken breast cooked (baked or air-fried), green top milk exact, potatoes and kumara boiled.
  - Goals: the 2,400 kcal default is fine; Balu sets his own in the app.
- Still to ask (next session): anything else on usability he noticed on the phone; whether to keep or drop features he finds confusing; screen-by-screen priorities. Then mock (design suite: ux-psychology, ux-patterns teardown of Apple Health, ui-states, design-critique), plan in BUILD-TASKS.md "v2", builders Codex first (it was at 86% of its window on 31 Oct), Sonnet fallback.
- Releases: bump APP_VERSION in src/version.js and VERSION in sw.js together, run unit + E2E (local and MD_BASE_URL live), push main; installed phones update on next open.
- Ideas not picked: BACKLOG.md.

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
