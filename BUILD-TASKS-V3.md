Vault: [[HOME]] | [[projects/active/macro-diary/STATE|Shredz state]] | [[projects/active/macro-diary/DESIGN-V3|v3 design]]

# Shredz v3 build tasks

Written 10 Nov 2026 by Fable 5.2.
Design authority is [[projects/active/macro-diary/DESIGN-V3|DESIGN-V3.md]]; rule IDs (K, S, D, T, F) and addition numbers (A1 to A25) refer to it.
v3 starts with an empty diary and the same foods, imported from `private/macro-diary-foods.json` (Balu, 10 Nov).

## Who does what

| Model | Job |
|---|---|
| Fable 5.2 | Design authority. Writes every brief, answers design questions, runs the design critique and motion review, signs off each wave by eye. |
| Opus 5.5 | Runs the build: dispatches jobs, merges to the `v3` branch, runs the unit and browser suites, keeps STATE.md current. |
| Codex Sol | Builds everything a command can check. At most three jobs at once, each owning separate files. |
| Codex Astra | Reviews each wave's diff with fresh eyes, and red-teams the finished app. |
| Sonnet 5.5 | Writes the browser test suites, and takes over any build job Codex fails twice or cannot take because of its limit. |
| Haiku 5.5 | Read-only look-ups in the code when a brief needs a fact. |
| Balu | Taps through the probe and the release checklist on his iPhone; says yes before anything is published. |

Every Codex brief carries: the task row, the rule IDs it must meet, `DESIGN-V3.dense.md`, the Astryx component docs it needs (`npx @astryxdesign/cli component <Name> --dense`), the files it owns, and its "done when" commands.
A job is done only when `npm run check` (types, unit tests, source check) passes.
`main` and any publish wait for Balu's yes.

## Wave 0: prove the ground (before any screen is built)

| # | Task | Subtasks | Builds | Reviews | Done when |
|---|---|---|---|---|---|
| W0.1 | Scaffold | Vite, React 19, TypeScript; Astryx core and neutral theme pinned at 0.7.11; `astryx init` into AGENTS.md; move logic to `src/core/` untouched; `npm run check` | Codex Sol | Opus | 374 unit tests green from the new location; blank app builds |
| W0.2 | Source check | Script failing on `<select`, `type="date"`, `type="number"`, raw hex or px outside `src/theme/`, AutoFill words in field ids (K2, K7, D1); file-header check | Codex Sol | Opus | Fails on planted samples, passes on a clean tree |
| W0.3 | Keyboard probe | One page: fixed frame (F1 to F6), Astryx full-height sheet, six cases (field labelled "Name", labelled "Food", search, text box, keypad, two-field form as the known-bad control), a result line under each | Codex Sol | Fable | Builds, runs in WebKit at phone size |
| W0.4 | Host the probe | Private preview address over HTTPS | Opus | Balu's yes | Opens on the iPhone |
| W0.5 | Phone check | Add to home screen; tap each case; scroll hard at top and bottom; note what iOS shows | Balu | Fable reads the results | Results written into DESIGN-V3 section 2; stack confirmed or switched to the vanilla fallback |
| W0.6 | Dense rules | `DESIGN-V3.dense.md`: every rule ID and addition at one line each | Fable | none | File exists; every later brief includes it |

## Wave 1: foundation (three jobs in parallel)

| # | Task | Subtasks | Builds | Reviews | Done when |
|---|---|---|---|---|---|
| W1.1 | Theme | Shredz tokens light and dark; type roles; text size follows the iPhone setting (A7); splash and theme colours (A2) | Codex Sol | Fable by screenshot | Token sheet page matches DESIGN-V3 7.1 in both modes |
| W1.2 | State | One store over `actions.js`; selectors so one changed row redraws alone (A3); screen first, storage second, roll back on failure (A4); undo pairs | Codex Sol | Astra | Unit tests, including a failed write rolling back |
| W1.3 | Core additions | `usualFor`; named portions (A13); quick calories entry type (A14); move entry (A15); meal names (A16); kJ conversion (A20); goal weight maths (A22); week averages (A23); schema version 3 with a fresh-start path | Codex Sol | Astra | Unit tests per function |
| W1.4 | Parser additions | "weight 82.4" (A10); "no, 200 grams", "remove the rice", "one and a half" (A17); portion words (A13); meal names (A16) | Codex Sol | Astra | Existing 186-case corpus still passes; 40 new cases written by Sonnet pass |
| W1.5 | Frame | Fixed app frame, status-bar band, one scroller per screen, bottom bar outside the scroller (F1 to F6); tab bar; toasts with Undo | Codex Sol | Fable | Browser test: document never scrolls; bars do not move on overscroll |

## Wave 2: the parts every screen uses

| # | Task | Subtasks | Builds | Reviews | Done when |
|---|---|---|---|---|---|
| W2.1 | Keypad | Keys, text-value rules, hardware keys, tap haptic (A6), no input element | Codex Sol | Astra | Rule tests; browser test finds no `input` while open |
| W2.2 | Amount sheet | Figure, live preview, quick amounts from named portions (A13), Add or Save, Remove, Move to another meal (A15), Edit this food (A18) | Codex Sol | Fable | Browser test: add, edit, move, remove with undo |
| W2.3 | Weigh-in sheet | Starts on the last weight, minus and plus 0.1, Save (A9) | Codex Sol | Fable | Browser test: two taps log today's weight |
| W2.4 | TextSheet | One field, Done key, composing guard (K4, K9) | Codex Sol | Astra | Browser test: exactly one text field in the document |
| W2.5 | DayLine, WeekStrip, WeightChart | Geometry as pure functions; week average line (A23); goal weight line (A22) | Codex Sol | Fable by screenshot | Unit tests on geometry |

## Wave 3: screens (three jobs in parallel, then two)

| # | Task | Subtasks | Builds | Reviews | Done when |
|---|---|---|---|---|---|
| W3.1 | Today | Brand row, week strip, hero, day line, macros, weight row first on a new day (A9), meal blocks, meal menu, five states | Codex Sol | Fable | Browser test: five states; edit, swipe delete, undo, copy |
| W3.2 | Log sheet, Pick | Meal chooser; search with forgiving match (A21); "Same as yesterday" first (A11); usual foods; saved meals with half, 1, one and a half, 2 (A12); quick calories (A14); running footer | Codex Sol | Fable | Browser test: three foods in three taps; nothing focused on open |
| W3.3 | Log sheet, Speak | Voice-level button, heard list, fix a row, "This is...", spoken weight (A10) and spoken fixes (A17), type instead | Codex Sol | Fable | Browser test with simulated speech: corpus sentences log correctly |
| W3.4 | Foods and Food editor | List with search; starter foods marked apart from your own (A19); editor rows on the keypad with Next; kJ or kcal, per 100 g or per serving (A20); named portions editor (A13) | Codex Sol | Fable | Browser test: a food with six numbers, no iPhone keyboard |
| W3.5 | Saved meal builder | Create and edit a saved meal from the Foods section, not only from the diary (A12) | Codex Sol | Astra | Browser test: build, edit, log at one and a half |
| W3.6 | Trends | Range switch, chart, goal weight and pace (A22), averages, weigh-in list | Codex Sol | Fable | Browser test: log, correct, chart redraws |
| W3.7 | Settings | Goals on the keypad, goal weight, meal names (A16), units (A25), data safety block (A24), about | Codex Sol | Astra | Browser test: backup round trip; safety copy before import |
| W3.8 | Welcome | Three steps; privacy line; starts with starter foods or an import (A25) | Codex Sol | Fable | Browser test: first run with no personal data |

## Wave 4: data and launch feel

| # | Task | Subtasks | Builds | Reviews | Done when |
|---|---|---|---|---|---|
| W4.1 | Starter foods | Check the licence of the source first; about 300 common NZ foods as one bundled file; your own foods always rank first (A19) | Sonnet (licence and curation), Codex Sol (loader) | Fable | Licence note in the repo; search returns in under 16 ms |
| W4.2 | Instant open | Today drawn from a saved snapshot before storage opens; splash screens per iPhone size, light and dark (A2) | Codex Sol | Astra | Browser trace: first paint under 300 ms warm, no flash |
| W4.3 | Installable app | Manifest, generated worker, silent update on next open (A8), install helper | Codex Sol | Astra | Offline reload test; update applies on the second open |
| W4.4 | Data safety | Ask the phone to keep storage; last-backup row and reminder; safety copy before import; export to Files (A24) | Codex Sol | Astra | Unit and browser tests |

## Wave 5: proof

| # | Task | Subtasks | Builds | Reviews | Done when |
|---|---|---|---|---|---|
| W5.1 | Browser suite | Every screen, five states, light and dark, 375, 390 and 430 px; the K, F and T rules as tests | Sonnet | Opus runs it | All green on WebKit |
| W5.2 | Speed budget | Tap to visible response under 100 ms; sheet open under 300 ms; no frame over 32 ms while scrolling Today with 40 rows; bundle size reported | Sonnet | Opus | Numbers recorded in STATE.md, all inside budget |
| W5.3 | Code review | Whole branch: personal data stays on the phone, no network calls, import cannot damage data | Codex Astra, then the reviewer agent | Opus | No open findings |
| W5.4 | Red team | Astra tries to break entry: paste, rotate, split keyboard, huge values, midnight, storage full | Codex Astra | Fable | Findings fixed or ruled out |
| W5.5 | Design critique | Screenshots of the built app against the mock, both themes; motion review | Fable | Balu by eye | Ranked fix list closed |

## Wave 6: release

| # | Task | Subtasks | Builds | Reviews | Done when |
|---|---|---|---|---|---|
| W6.1 | Publish | Host as Balu chooses; live browser suite | Opus | Balu's yes first | Green on the live address |
| W6.2 | Phone checklist | Install; import foods; ten taps covering each text field, the keypad, a spoken meal, a weigh-in, hard scrolling at both ends | Balu | Fable | Balu ticks every line |

## Order

W0 gates everything.
W1.1 to W1.5 run three at a time as soon as W0.5 passes.
W2 follows W1.2 and W1.5; W3 follows W2; W4 can start alongside W3.
Astra reviews at the end of each wave, not at the end of the build, so problems are caught while the context is small.
