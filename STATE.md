Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[PORTFOLIO|Portfolio]]

# STATE: Macro Diary

## Current state
v3 probe LIVE 10 Nov 2026 at https://balupremkumar.github.io/shredz/ (repo public again for the install; v2 is retired at that address). Was live 31 Oct at https://balupremkumar.github.io/shredz/ (repo balupremkumar/shredz, GitHub Pages from main). v2.0.0 pushed 31 Oct, 57 E2E green against live.
E2E against the live site: 32 green (WebKit, iPhone 15). Unit 141 green. Commits use the GitHub no-reply email (history rewritten before first push; local tag pre-publish-backup holds the old history).
Balu's 13 NZ foods: private/macro-diary-foods.json (git-ignored, never pushed); estimates to check in private/foods-research.md.

## Next steps
- v3 BUILD STARTED 10 Nov 2026 on branch `v3` (Balu's go-ahead). Wave 0 done and live: Vite + React 19 + Astryx 0.7.11 scaffold, logic moved to src/core untouched (334 unit tests green), fixed frame, keypad (src/core/keypad.js, src/ui/components/Keypad.tsx), `npm run check` (types, unit tests, scripts/check-source.mjs), and the phone probe (src/ui/Probe.tsx). Probe is live at https://balupremkumar.github.io/shredz/ from the `gh-pages` branch (built dist, pushed from a worktree; main untouched). Repo made public again for the install on Balu's say-so; he wants it private once v3 is agreed. WAITING ON BALU: tap through the six probe cases on his iPhone (W0.5) and report what iOS shows; confirm the food list in private/foods-v3.json (20 foods; "mints" read as unclear, mince or mints) and whether foods ship inside the public build or stay an import.
- v3 rulings from Balu, 10 Nov: not for sale, a personal one-and-done app with no planned updates; forgiving search and dictation are the priority ("chicken breast and rice, 100 grams of each", "one chicken breast", word order, misspellings), always fixable by hand; fresh start with his foods built in. So A19 becomes "your foods built in" and A25 (ready for someone else) is dropped; BUILD-TASKS-V3 W1.4 carries the dictation cases.
- Next after the probe: wave 1 (theme polish, store bindings, core additions, parser additions incl. "of each" and portions, tab bar and toasts) with Codex Sol, two jobs at a time (cx cap). Before the first Codex job: update tools/codex/repos.json (install npm ci, gate npm run check) and repos/macro-diary.AGENTS.md for the v3 stack. Design: [[projects/active/macro-diary/DESIGN-V3|DESIGN-V3.md]]; tasks: [[projects/active/macro-diary/BUILD-TASKS-V3|BUILD-TASKS-V3.md]]; mock: mock/v3/index.html.
- Keyboard pop-up cause found 10 Nov: the food form (eight text fields plus a native select in one form, src/ui/foods.js:77-86) is what raises the iOS up/down/tick bar and AutoFill; attributes cannot switch those off in a web app.
- RESUME HERE (paused 31 Oct 2026 for a PC restart, mid-way through v2 decision questions): Balu installed Shredz on his iPhone and wants a v2 overhaul. Finish the questions, show the plan and a mock, get his yes, then build.
- v2 decisions LOCKED (Balu, 31 Oct):
  - Style: Apple Health / iOS native (grouped lists, edge-to-edge rows, subtle dividers, few boxes). He called v0.2 "bubbly", "cramped", "misaligned", "amateur"; fix spacing, hierarchy and alignment so the eye goes where it should.
  - Theme: follow the iPhone light/dark setting.
  - Logo: Kove mark as the home-screen icon; in-app header shows the Kove mark plus the word "Shredz" in the Kove typeface (assets in D:\Dev\ai\design-system).
  - Onboarding: 3-step welcome on first open (set goals, check foods, try a dictation).
  - Dictation UX: big in-app mic button (iPhone speech recognition where it works) with automatic keyboard-mic fallback, live "I heard" list.
  - Dictation accuracy: real failure, verbatim: "Weet-Bix, 3 servings," then "Chicken breast, 100 grams," gave "Chicken breast x 100 grams" (the amount was mis-bound). "100 grams of chicken breast" must equal "chicken breast 100 grams"; "servings" must count. Balu suggests learning his speech patterns from Quiett (D:\Dev\ai\projects\active\quiett, and memory dictation-profile.md) to build a test corpus.
  - Nutrition: Claude validates every value itself online (no label photos), aiming for the most commonly used AU/NZ values (MyFitnessPal's sources, FSANZ AUSNUT, NZ FOODfiles, brand pages), cross-checked across sources. Basmati cooked (boiled, absorption), chicken breast cooked (baked or air-fried), green top milk exact, potatoes and kumara boiled.
  - Goals: the 2,400 kcal default is fine; Balu sets his own in the app.
- More v2 decisions LOCKED (31 Oct, second session): pain points were finding dictation, fixing a wrong item, small text and tap targets; drop goal modes (grams per macro only) and fold the weekly report into one Averages row on Weight; Diary hero is a calorie ring; mic floats above the tab bar, bottom right.
- Keyboard bugs Balu hit on the phone (v0.2, fix in v2): add-food search results jump to the top and the bottom half can't be used; the Passwords/card AutoFill bar shows above the keyboard; quantity field and Save button end up off screen; hard to scroll back to the top. Plan: sheets follow visualViewport, Save docked on the keyboard edge, autocomplete off, one scroller at a time.
- Done this session: dictation corpus (tests/fixtures/dictation-corpus.json, 186 cases, baseline 111 pass / 61 fail / 14 skipped; notes in private/dictation-corpus-notes.md); nutrition re-check (private/foods-research-v2.md: rice cake 24 kcal, toast slice 90/3.4/16.6/0.8, Scorpion whey 132/25.0/2.6/2.2, other 10 unchanged); mock at mock/v2/index.html (design suite run, critique fixes applied).
- The "Chicken breast x 100 grams" failure does NOT reproduce from text in parser.js (text gives Weet-Bix 2 + chicken 100 g, "3 servings" dropped): reproduce in the dictate UI on WebKit first when the build starts.
- Balu said yes to the mock (31 Oct); servings = N x defaultQty for g/ml foods; Weet-Bix 750 g box (53 kcal); Anchor Trim. Nutrition changes applied to private/macro-diary-foods.json (phone needs Settings, Import, Merge after release).
- v2 BUILT on branch `build` as 2.0.0 (31 Oct): all V-tasks merged (parser 172/172 corpus, iOS design light/dark, goals grams-only, keyboard-safe sheets, Speak sheet, Diary ring + Speak button + quantity sheet, 3-step welcome, polish, review hardening). Unit 374 pass, E2E 57 pass locally (WebKit iPhone 15). Reviewer pass done, no open findings. PUSHED to main 31 Oct (Balu's yes), live E2E 57/57.
- Next: Balu re-imports private/macro-diary-foods.json (Settings, Import, Merge) and checks on the phone: real keyboard and AutoFill bar, status bar style (index.html default), speech recognition in the home-screen app (falls back to keyboard mic if iOS blocks it).
- Codex rule (Balu, 31 Oct): use Codex as much as possible to save Claude usage; Sonnet when Codex is over its limit.
- Releases: bump APP_VERSION in src/version.js and VERSION in sw.js together, run unit + E2E (local and MD_BASE_URL live), push main; installed phones update on next open.
- Ideas not picked: BACKLOG.md.

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
