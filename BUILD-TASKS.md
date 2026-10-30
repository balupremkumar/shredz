Vault: [[HOME]] | [[projects/active/macro-diary/PLAN|Plan]] | [[projects/active/macro-diary/STATE|State]]

# Macro Diary build tasks (31 Oct 2026, awaiting Balu's green light)

Builder rule: Codex (GPT, Sol) builds every module whose result a command can check; Sonnet takes over any job when Codex usage passes 80% of its 5-hour window or a job fails twice; Opus writes briefs, reviews diffs and runs the end-to-end tests.
Codex runs at most 3 jobs at once, each owning separate files; everything merges to the `build` branch, and `main` only with Balu's yes.

## Install on the phone (no certificate needed)

GitHub Pages serves the app over HTTPS with a valid certificate, so nothing has to be installed or trusted on the iPhone.
Steps for Balu: scan a QR code (or open the link) in Safari, tap Share, tap Add to Home Screen, done.
The app shows these three steps itself whenever it is opened in Safari instead of from the home screen.
After the first open it works with no signal (airplane mode).

## Tasks

| # | Phase | Task | Subtasks | Builder | Done when |
|---|---|---|---|---|---|
| T0 | Foundation | Repo, plan, Codex registration | git repo, MIT licence, PLAN, STATE, test runner, cx repo entry | Opus | Done 31 Oct |
| T1 | Foundation | Dictation parser `src/parser.js` | meal markers, number words, units incl. "125g", aliases, longest match, unmatched, "save"/"saved" | Codex Sol | Done 31 Oct, 13 tests |
| T2 | Foundation | Diary maths `src/diary.js` | scaling, meal and day totals, remaining, copy meal, copy day, last logged day, weights | Codex Sol | Done 31 Oct, 11 tests |
| T3 | Design | Mock v2 (Kove plus Cursor) | Diary, Dictate (live line), Confirm, Weight | Sonnet | Balu green light |
| T4 | Core | Storage `src/store.js` | IndexedDB stores foods, entries, weights, settings; same API over an in-memory backend for tests; schema version and upgrade path | Codex Sol | unit tests on memory backend; E2E proves IndexedDB |
| T5 | Core | Backup `src/backup.js` | export all data to a dated JSON file, import with validation and a "replace or merge" choice, reject bad files | Codex Sol | round-trip unit tests |
| T6 | Core | Dates and formats `src/format.js` | local today string, add days, "Today", "Yesterday", "Sat 31 Oct", kcal "1,561", grams "81.5 g" | Codex Sol | unit tests incl. daylight saving days |
| T7 | UI | Styles `styles.css` | Deep Cove tokens, Cursor-style pills, sections, sheets, tab bar, safe areas, self-hosted Schibsted Grotesk | Codex Sol | Opus screenshot check against mock v2 |
| T8 | UI | App shell `index.html`, `src/app.js` | tab bar (Diary, Foods, Weight), date navigation, app state, screen stubs each later job fills | Codex Sol | shell loads, tabs switch (E2E) |
| T9 | UI | Diary screen `src/ui/diary.js` | summary equation, macro bars, one-tap morning weight (when today has no weight the top row is a live decimal input prefilled with the last weight plus a Log pill; one tap opens the keypad, one tap saves; once logged it collapses to "82.4 kg, -0.6 this week"), meals, add food from list, edit qty, delete, copy meal, copy yesterday, empty-day state | Codex Sol | E2E: log, edit, delete, copy, totals match |
| T10 | UI | Dictate and confirm `src/ui/dictate.js` | text box with keyboard mic hint, live line per meal, unrecognised line, confirm screen, add as food, save | Codex Sol | E2E: Balu's sentence logs 839 kcal correctly |
| T11 | UI | Foods and goals `src/ui/foods.js` | food list, add, edit, delete (blocked if used, or kept for history), aliases, unit and per-amount, daily goals | Codex Sol | E2E: create food, use it, edit macros |
| T12 | UI | Weight screen `src/ui/weight.js` | morning entry, 30-day line chart, recent list with change | Codex Sol | E2E: log weight, chart and diary row update |
| T13 | UI | Settings `src/ui/settings.js` | goals, export, import, app version, "how to install" | Codex Sol | E2E: export then import restores data |
| T14 | PWA | Installable app | manifest, Kove app icon (180 px touch icon plus maskable), status-bar style, full-screen launch, service worker cache with version bump and "update ready" prompt | Codex Sol | Lighthouse-style checks plus offline E2E |
| T15 | PWA | Install helper | detects Safari (not home screen), shows the 3 steps with Share icon | Codex Sol | E2E in WebKit, standalone vs not |
| T16 | Test | End-to-end suite `e2e/` | Playwright with WebKit (Safari's engine) at iPhone 15 size: first run, foods, tap logging, dictation, copy, edit, weight, reload persistence, offline reload, backup round trip, no sideways scroll at 375, 390 and 430 px | Opus writes and runs | all green, run log saved |
| T17 | Test | Visual review | screenshots of every screen and state (empty, loading, error, full), compared with mock v2, design critique | Opus | ranked fix list closed |
| T18 | Test | Code review | reviewer pass over the whole diff (personal data stays on device, no network calls, import cannot break data) | Sonnet reviewer | no open findings |
| T19 | Test | Real Chrome check | open the built app in your Chrome via Claude in Chrome at phone size | Opus | screenshots match |
| T20 | Ship | GitHub repo and Pages | create public repo, push, turn on Pages, merge `build` to `main` | Opus, only after Balu's yes | live HTTPS URL |
| T21 | Ship | Live smoke test | rerun E2E against the live URL, check service worker and manifest | Opus | green on live |
| T22 | Ship | Phone install | QR code and 3-step guide in README and on a small landing page; Balu installs; checklist: full screen, works in airplane mode, keyboard mic dictation logs a meal | Balu, Opus guides | Balu ticks the checklist |
| T23 | Later | Preload Balu's foods | Balu lists his foods; Opus fills macros from the labels; loaded through import | Opus | foods appear on first open |

## Order and parallel lanes

1. After green light: T4, T5, T6 in parallel (Codex, 3 jobs).
2. Then T7 and T8 (shell and styles), then T9 to T13 in two waves of up to 3 Codex jobs each.
3. T14 and T15, then T16 to T19 (Opus tests, Sonnet review), fixes go back to Codex as resumes or new jobs.
4. T20 to T22 after Balu's yes to push.

## v1.1 quality of life (Balu's picks, 31 Oct 2026, awaiting green light)

| # | Feature | What it does | Builder | Done when |
|---|---|---|---|---|
| Q1 | Saved meals | "Save as saved meal" from any meal; saved meals listed at the top of Add food; one tap adds every item | Codex Sol | E2E: save, reuse on another day |
| Q2 | Say saved meal names | Dictation "Meal one, usual breakfast. Save." logs the whole saved meal (parser matches saved meal names like foods) | Codex Sol | parser tests plus E2E |
| Q3 | Recent foods first | Add food lists the most-used foods of the last 30 days first, then the rest A to Z | Codex Sol | E2E order check |
| Q4 | Quantity +/- buttons | Minus and plus on each diary item; step 1 for items and scoops, 25 g or 50 ml for weights and volumes | Codex Sol | E2E totals update |
| Q5 | Learns your words | On Confirm, a not-recognised word gets "This is..." to pick the food; the word is saved as another name for it | Codex Sol | E2E: next dictation matches |
| Q6 | 7-day average line | Smoothed trend line under the daily points on the weight chart | Codex Sol | unit test of the average, screenshot |
| Q7 | Weigh-in badge | Home-screen icon badge while today's weight is missing (Badging API, installed app only; set on open, cleared on log) | Codex Sol | unit test of the rule, live on phone |
| Q8 | Weekly report | Settings or Weight: average kcal, protein, carbs, fat and weight change over 7 and 30 days | Codex Sol | unit tests plus screenshot |
| Q9 | Goal modes | Switch between calories plus % split (must total 100, grams worked out) and grams per macro (calories worked out at 4/4/9) | Codex Sol | unit tests plus E2E |
| Q10 | CSV export | Settings: export days (date, meal, food, qty, kcal, P, C, F) and weights as CSV via the share sheet | Codex Sol | unit test of CSV, E2E download |
| Q11 | Swipe to delete | Swipe a diary item left to reveal Delete | Codex Sol | E2E touch swipe |
| Q12 | Copy day to any date | From any day: "Copy this day to..." with a date picker (today preselected) | Codex Sol | E2E |
| Q13 | Larger text | Settings toggle that scales type about 15 percent, remembered on the phone | Codex Sol | screenshot at 375 px, no sideways scroll |

Foods: Balu's 13 foods are ready in `private/macro-diary-foods.json` (git-ignored, never published); import with Settings, Import backup, Merge.
