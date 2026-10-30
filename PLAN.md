Vault: [[HOME]] | [[projects/active/macro-diary/STATE|Macro Diary state]] | [[research/open-source-myfitnesspal-alternatives-2026-10-31/REPORT|Research]]

# Macro Diary plan (31 Oct 2026)

Working name, renamable.
A MyFitnessPal-style food and weight diary that runs entirely on Balu's iPhone.
Revives the parked Local FitnessPal idea in a new form (iPhone, no server); the old app at `projects\archive\fitness-pal` stays archived.

## Scope

In: morning weight, food per numbered meal (Meal 1, 2, ...), grams or ml or items or scoops per food, calories, protein, carbs and fat totals live as you log, copy a meal or a whole day from another date, dictation.
Out: food database, barcode scanning, accounts, sync, fibre, micronutrients, workouts, AI.
Foods: Balu's own short list with macros, entered in the app; preloading his real list is a later step (he supplies it).

## Decisions (Balu, 31 Oct 2026)

- Installable web app (PWA) added to the iPhone home screen from Safari; no Mac, no App Store.
- Dictation through the iPhone keyboard microphone into a text box; the app parses the text on the phone against the food list. No AI, no network.
- Numbered meals.
- Code hosted on public GitHub Pages (open source, MIT); the diary data never leaves the phone.

## Architecture

Plain HTML, CSS and ES modules. No framework, no build step, no runtime dependencies.
Data lives in IndexedDB on the phone (stores: foods, entries, weights, settings), plus a JSON export and import for backups.
Home-screen PWAs are exempt from Safari's 7-day storage eviction; export is the safety net anyway.

```
index.html            app shell, three tabs: Diary, Foods, Weight
src/parser.js         dictation text -> meals and items (pure)
src/diary.js          nutrition maths, totals, copy meal/day, weights (pure)
src/store.js          IndexedDB adapter + export/import
src/ui/*.js           screens
sw.js, manifest.webmanifest, icons/
tests/*.test.mjs      node --test, no dependencies
```

## Data model

Food: `{ id, name, aliases: string[], unit: 'g'|'ml'|'item'|'scoop', baseQty, defaultQty, kcal, protein, carbs, fat }`.
Nutrition values are per `baseQty` of `unit` (100 for g and ml, 1 for item and scoop).
Entry: `{ id, date: 'YYYY-MM-DD', meal: 1.., foodId, qty }`, qty in the food's unit.
Weight: `{ date, kg }`. Settings: `{ goals: { kcal, protein, carbs, fat } }`.
Totals sum unrounded values, then round: kcal to whole numbers, macros to one decimal.

## Dictation

Example: "Meal number one, 2 Weet-Bix, green milk 200 mils and one scoop of whey protein. Meal number two, chicken breast 125 grams, basmati rice 150 grams and 20 grams of cashews. Save."
Flow: tap Dictate, the text box opens with the keyboard up, tap the keyboard mic, speak, a live preview shows matched items with calories and flags anything unmatched, "save" (spoken or tapped) logs it.
Matching squashes spaces and hyphens so mis-hears like "We et-Bix" still hit "Weet-Bix"; each food carries aliases.

## Phases and who builds

| Phase | What | Builder | Check |
|---|---|---|---|
| 0 | Repo, plan, phone mock for Balu's sign-off | Claude + Sonnet (frontend) | Balu approves the mock |
| 1a | `src/parser.js` + tests | Codex Sol | `node --test` gate, Claude review |
| 1b | `src/diary.js` + tests | Codex Sol | `node --test` gate, Claude review |
| 2 | Store, UI screens, wiring | Sonnet (frontend) | headless Edge at iPhone size, design-critique |
| 3 | PWA shell, icons, export/import | Sonnet (frontend) | offline reload test |
| 4 | GitHub repo + Pages deploy | Claude, after Balu's yes (push) | install on the iPhone |
| 5 | Preload Balu's foods | Claude | Balu's list |

Cost rule: Opus plans and reviews only; Codex and Sonnet do the building.
