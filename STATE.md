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
- v2 BUILT on branch `build` as 2.0.0 (31 Oct): all V-tasks merged (parser 172/172 corpus, iOS design light/dark, goals grams-only, keyboard-safe sheets, Speak sheet, Diary ring + Speak button + quantity sheet, 3-step welcome, polish, review hardening). Unit 374 pass, E2E 57 pass locally (WebKit iPhone 15). Reviewer pass done, no open findings. NOT PUSHED: main is still 0.2.0 live.
- Next: Balu's yes to merge build into main and push; then rerun E2E with MD_BASE_URL live; then Balu re-imports private/macro-diary-foods.json (Settings, Import, Merge) and checks on the phone: real keyboard and AutoFill bar, status bar style (index.html default), speech recognition in the home-screen app (falls back to keyboard mic if iOS blocks it).
- Codex rule (Balu, 31 Oct): use Codex as much as possible to save Claude usage; Sonnet when Codex is over its limit.
- Releases: bump APP_VERSION in src/version.js and VERSION in sw.js together, run unit + E2E (local and MD_BASE_URL live), push main; installed phones update on next open.
- Ideas not picked: BACKLOG.md.

## Open bugs
None.

## Key files
- PLAN.md: scope, data model, phases.
- src/parser.js, src/diary.js: pure logic, tested with `npm test`.
