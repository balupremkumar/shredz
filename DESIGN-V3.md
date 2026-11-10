Vault: [[HOME]] | [[projects/active/macro-diary/STATE|Shredz state]] | [[projects/active/macro-diary/BUILD-TASKS|Build tasks]] | [[research/astryx-2026-11-10|Astryx rundown]]

# Shredz v3 design and build spec

Status: design handed to Fable by Balu on 10 Nov 2026 ("I'll trust your design"); extended the same day with the frame rules and 25 additions; the build waits on his go-ahead for the task list.
Nothing here is built.
Mock: `mock/v3/index.html`, published at https://claude.ai/artifact/MfiwTg1moBHF7TxBxoZnHZ (private to Balu).
Reference clone: `D:\Dev\refs\astryx` (meta/astryx at commit 3312a58, MIT).
Rules in this file carry IDs (K, S, D, T) so builders and reviewers can cite them.
A rule is binding once this file's status says approved.

## 1. What v3 is

Shredz stays a local-only iPhone food and weight diary for one person, installed from Safari to the home screen.
v3 is a rebuild of the screen layer only.
The logic that already works (dictation parser, diary maths, storage, backup, formats, insights) is kept as it is, with its 374 unit tests.
The stored data shape does not change, so the diary on the phone carries over.

v3 fixes three things v2 did not.
The iPhone keyboard and its pop-up bar get in the way of typing.
Logging by hand takes too many taps for someone who eats the same 13 foods.
The screens re-draw themselves from scratch on every change, which is where the small layout glitches come from.

## 2. The keyboard problem, and the answer

What Balu sees is two separate pieces of iOS.
The first is the form bar above the keyboard, with up and down arrows and a tick.
iOS shows it whenever a page has more than one field to move between, and it shows a spinning picker in the same place for a dropdown.
The second is the AutoFill box that offers a card, a password or a contact.
iOS shows it when a field looks like a name, an email or a number it knows.
A web app cannot switch either of them off.
Only a native app can.
v2 tried to hide them with field attributes, which iOS is free to ignore, and the food form (eight text boxes and a dropdown in one form) is the worst case for both.

v3 stops asking iOS for a keyboard wherever it can.

- K1. No number is ever typed on the iPhone keyboard. Amounts, weight, goals and nutrition values use Shredz's own keypad (section 6.1).
- K2. No native dropdown, date picker or number field anywhere. No `<select>`, no `type="date"`, no `type="number"`. Choices are rows or a segmented control.
- K3. The iPhone keyboard opens for free text only: a food's name, its other names, a saved meal's name, the food search, and typed dictation.
- K4. Each of those is one field alone on its own sheet or screen, never two text fields in the same view. With one field there is nothing for the up and down arrows to move to.
- K5. Nothing takes focus on open. The search field in the Log sheet waits for a tap, so opening the sheet never raises the keyboard.
- K6. Text fields live only inside a full-height sheet or a full screen that owns its own scrolling, so the page behind never moves.
- K7. Field wording avoids AutoFill bait: the label is "Food", never "Name"; no field id, name or placeholder contains name, email, card, address, phone or code.
- K8. Every text field is 17 px or larger, so iOS never zooms the page on focus.
- K9. Enter and Escape handlers ignore key events while the keyboard is composing a word (`event.isComposing || event.keyCode === 229`), so iOS predictive text and dictation never save a half-finished word.
- K10. When a sheet starts to move (drag, close), the focused field is blurred first so the keyboard leaves with it.

K1, K2, K4 and K5 remove the cause for nearly every screen.
K3 leaves five places where iOS may still show its bar, and what it shows there has to be measured on the real phone, which is task P0.

## 3. Stack

| Layer | v2 | v3 |
|---|---|---|
| Screens | Hand-written DOM, full re-draw on every change | React 19 components, TypeScript |
| Components | Hand-rolled sheet, swipe row, toast | Astryx core 0.7.11 (BottomSheet, Item, List, Toast, SegmentedControl, Switch, TextInput, Skeleton, EmptyState), pinned exactly |
| Styles | One hand-written stylesheet | Astryx tokens through a Shredz theme, plus small local styles that use only those tokens |
| Build | None | Vite, output to `dist/` |
| Offline | Hand-written service worker | `vite-plugin-pwa` generated worker, same "update ready" prompt |
| Logic | `src/*.js` | The same files, moved to `src/core/`, unchanged, still plain JavaScript with their tests |
| Tests | Node unit tests, Playwright WebKit | The same, plus the keyboard rules as tests (section 9) |

Why Astryx components and not only its ideas.
Its bottom sheet carries measured iOS behaviour that v2 got wrong twice by hand: drag physics, scroll hand-off, scroll locking, taps ignored during the entrance, and keeping a focused field above the keyboard in a full-height sheet.
Its CLI serves each component's props and rules to an agent on request, which is what makes this safe to hand to Codex.
It is a beta, so the version is pinned and upgrades are a deliberate task.

What Astryx does not give us, and we build as small local components: the keypad, the tab bar, the day line, the week strip and the weight chart.
Its phone tab bar and progress ring exist only in its experimental package, which is not on npm in a stable form, so v3 does not depend on them.

The stack is confirmed or dropped by P0.
If Astryx's sheet misbehaves in the installed app on Balu's iPhone, the fallback is v2's vanilla screens with the same design and the rules in this file ported by hand.

## 4. Structure

Four sections and one action, in a bottom bar: Today, Foods, Log, Trends, Settings.
Log is not a section.
It is the single way to add food, a filled button in the middle of the bar where the thumb rests, and it opens the Log sheet over whatever section is showing.
Tapping the section you are already on scrolls it to the top.

- S1. One primary action per view. On the four sections it is Log.
- S2. The tab bar uses words, not icons. Balu's standing rule is that no icons beat cheap ones, and the words are what gets read anyway.
- S3. The app draws no icon glyphs of its own. The Kove mark, and the characters `+`, `‹`, `›`, `▾` and `⌫`, are the whole set.
- S4. Settings moves from a gear in the top corner (the hardest reach on a phone) into the bar.
- S5. Sheets never stack more than two deep (Log, then Amount).

## 5. Screens

Each screen lists its content from top to bottom, then its five states.

### 5.1 Today

1. Brand row: Kove mark and "Shredz" in Schibsted Grotesk at the left, the date at the right.
2. Week strip: seven days, Monday first. Each day is a thin bar showing that day's calories against the goal, red when over, empty for days ahead. Tapping a day shows it. Swiping the strip sideways moves a week. The title of a past day reads "Mon 9 Nov" with a "Back to today" row beneath the strip.
3. Hero: the calories left as the largest figure on the screen, "kcal left" beside it, and "820 eaten, 2,400 goal" at the right. Over goal it reads "140 kcal over" in the error colour.
4. Day line: one horizontal bar the width of the screen, filled left to right by each meal in turn, with a legend naming each meal's calories. It answers "where did the day go" in a way a ring cannot. Over goal, the bar is full and the last segment turns to the error colour.
5. Macros: three columns, Protein, Carbs, Fat, each "eaten / goal g" with a thin bar. Protein is the only one in the accent colour.
6. Weight row: before a weigh-in, "Log this morning's weight" with the last weight shown; after, the weight and the change this week. Either opens the keypad.
7. One grouped block per meal: "Meal 1" and its totals, then a row per food with the amount beneath the name and calories and protein at the right. Tapping a row opens Amount. Swiping a row left deletes it, with Undo in a toast. The block ends with "Add to Meal 1", which opens Log aimed at that meal.
8. A menu on each meal's heading ("Copy from another day", "Save as a saved meal", "Copy this meal to...") opens as a sheet of rows.
9. After the last meal, a row "Start Meal 3", and when yesterday had one, "Copy Meal 3 from yesterday, 420 kcal".

States.
Empty: the hero shows the full goal, the day line is empty, and one block says "Nothing logged today" with "Copy yesterday, 5 foods, 2,310 kcal" when there is one, and "Tap Log to add your first food".
Loading: the layout drawn as grey shapes of the final sizes while storage opens, so nothing jumps.
Partial: one food in one meal looks complete; a long food name wraps to two lines and the figures stay on the first.
Error: storage unavailable replaces the screen with what happened and a "Try again" button; a failed save keeps what was entered and says so in a toast.
Ideal: as mocked.

### 5.2 Log sheet

A full-height sheet with a grab handle.
Heading row: the meal it is adding to at the left ("Meal 2 ▾", tap to choose another or a new one), "Log" in the middle, "Done" at the right.
Under it, a two-part switch: Speak and Pick. It opens on whichever was used last.

Pick.
1. Search field, "Search 13 foods". Not focused on open (K5). Typing filters the lists below as you type.
2. "Usual for Meal 2": the foods logged in this meal most often over the last 30 days, most frequent first, up to five.
3. "Saved meals".
4. "All foods", most used first.
Each row shows the food and its usual amount and calories.
The `+` at the right adds the usual amount at once, marks the row "added", and keeps the sheet open.
Tapping the row itself opens Amount.
A footer keeps a running count, "2 added, 508 kcal to Meal 2", with Undo for the last one.

Speak.
1. A large round button that starts listening on open, showing live voice-level bars and "Tap to stop".
2. The words heard so far, with the unfinished part in grey.
3. "I heard": one row per recognised food. Tapping a row opens Amount to correct it.
4. An unrecognised word shows in the error colour with three actions: "This is..." (opens the food list to pick from, and Shredz remembers the word), "New food" (opens the Food editor with the name filled in), "Skip".
5. Footer button: "Save 2 foods, 508 kcal". Saying "save" does the same.
6. "Type instead" swaps the button for one text box, the only field on the sheet (K4).
Where the phone blocks speech recognition, the sheet opens on "Type instead" and says to use the microphone key on the keyboard.

States.
Empty: no foods yet shows "Add the foods you eat and they appear here" with "New food".
Loading: none, the data is already in memory.
Partial: with fewer than five logged days, "Usual for Meal 2" is left out rather than shown thin.
Error: microphone refused says so in plain words and switches to typing; a failed save keeps the heard list.
Ideal: as mocked.

### 5.3 Amount

Pushed inside the Log sheet, or opened on its own from a diary row or the weight row.
The food's name in the heading with "Back".
The amount as a large figure with its unit, and a live line beneath: "248 kcal, 46.5 g protein".
Four quick amounts: for grams and millilitres, the usual amount and three round ones near it; for counted foods, half, 1, 2, 3.
The keypad.
One button: "Add to Meal 2", or "Save" when editing, with "Remove from Meal 2" as a quiet row above the keypad when editing.
The button is off until the amount is above zero.

### 5.4 Foods

A search field, then every food as a row: name, then "per 100 g: 165 kcal, 31 g protein".
"New food" is the first row of the list, not a bar across the bottom.
Tapping a food opens the Food editor.

### 5.5 Food editor

A full-height sheet that only Cancel and Save can close, so a stray swipe cannot lose the entry.
1. "Food" and "Also called" as two rows. Each opens a one-field sheet with the iPhone keyboard and a Done key (K3, K4).
2. The unit as four buttons: grams, ml, each, scoops.
3. "Nutrition per 100 g" (tap the amount to change it), then rows for Calories, Protein, Carbs, Fat and Usual amount.
4. Tapping a number row docks the keypad at the bottom with the row's name and a "Next" key that moves down the rows. Six numbers go in with six runs of digits and five taps of Next, without the iPhone keyboard.
5. "Delete food" at the very bottom, alone, in the error colour. A food that is in the diary or a saved meal cannot be deleted and the row says why.

### 5.6 Trends

A switch for 30 days, 90 days, All.
Today's weight as the large figure, with the change over the range.
A chart: each morning as a dot, the 7-day average as the line, drawn to scale with three labelled gridlines.
Two rows of averages: last 7 days and last 30 days, each with calories and protein a day and the weight change.
Recent weigh-ins as rows; tapping one opens the keypad.
Empty: "Log your weight for a few mornings and the line appears here", with a "Log this morning's weight" row.

### 5.7 Settings

Daily goals: protein, carbs and fat in grams on the keypad, calories worked out beneath.
Larger text: a switch.
Your data: Export backup, Import backup, Export as spreadsheet.
About: version, "Check for an update", how to install on the home screen.

### 5.8 Welcome

Three steps on first open, unchanged in purpose from v2: set goals (on the keypad), check your foods, try one spoken meal.
Each step can be skipped.

## 6. Local components

Each lives in `src/ui/components/<Name>/` with the component, its test and a short doc file (section 10).

### 6.1 Keypad

Twelve keys in a four by three grid: 1 to 9, decimal point, 0, delete.
Keys are at least 54 px tall in the Amount sheet and 42 px when docked in the Food editor.
The value is held as text, so "0." and "1.50" show as typed.
Rules: one decimal point; at most five digits; the first key after opening replaces the value that was there; delete on a fresh value clears it; holding delete clears all.
The figure it edits is announced as a spin button with its value and unit, and takes digits, point, Backspace and Enter from a hardware keyboard so tests and desktop use work.
It contains no `<input>` at all, which is what keeps the iPhone keyboard away.
Each key responds on touch-down.
On iPhone each key is a label wrapping a hidden switch, which is the one way Safari will play a tap haptic; this is Astryx's technique (`packages/core/src/gestures/haptics.ts`) and is switched off if P0 shows it misfires.

### 6.2 TabBar

Five equal cells; the middle one is the Log button.
Height 52 px plus the home-indicator inset.
The current section is in the accent colour and bold, and carries `aria-current`.

### 6.3 DayLine

Takes the goal and a list of meal totals.
Segment widths are each meal's share of the goal, with 2 px between segments.
Three accent tones repeat in order for meals past the third.
It is a picture with a text equivalent ("820 of 2,400 kcal across two meals").

### 6.4 WeekStrip

Seven day cells with a bar and a letter.
Each cell is a button with a full label ("Monday 9 November, 2,210 of 2,400 kcal").

### 6.5 WeightChart

Inline SVG drawn from the data with one scale for dots, line, gridlines and labels.
No chart library.

### 6.6 TextSheet

The one-field editor behind K4: a heading, one text field, a Done key on the keyboard, Cancel and Save in the heading.
Used for a food's name, its other names, a saved meal's name and typed dictation.

## 7. Look

Carried over from Balu's v2 decisions: iOS grouped lists, light and dark following the phone, Kove mark and wordmark, larger text and targets.
Checked against his ban list: no gradients, no glow, no glass, no shadows, no pill buttons, no Inter, no outline icons, no cards inside cards, no coloured-dot badges.
Corners are rounded on purpose, which is the iOS exception he already granted for this app.

### 7.1 Tokens

The Shredz theme is `src/theme/shredzTheme.ts`, made with Astryx's `defineTheme` on top of its neutral theme, and built to CSS by `astryx theme build`.
Values are light then dark.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--color-background-body` | #F1F3F6 | #000000 | Screen |
| `--color-background-surface` | #FFFFFF | #1A1C1F | Grouped rows, keys |
| `--color-background-muted` | #E6E9EE | #2A2D31 | Search field, switch track, docked keypad |
| `--color-text-primary` | #0D1116 | #F1F3F6 | Text |
| `--color-text-secondary` | #55606B | #A3ACB5 | Second lines, labels |
| `--color-border` | 13% of text | 16% of text | Hairlines between rows |
| `--color-track` | 9% of text | 13% of text | Empty bars |
| `--color-accent` | #0A6FC2 | #4AA8F2 | Log, links, protein, the average line |
| `--color-on-accent` | #FFFFFF | #04101F | Text on accent |
| `--color-accent-muted` | 13% of accent | 18% of accent | Selected row, the `+` button |
| `--color-error` | #C4262E | #FF6B63 | Over goal, unrecognised, delete |

Local tokens, in the theme's own namespace: two lighter accent tones for the second and third meal on the day line.

Type. Body is the phone's own font. Figures that carry the screen (calories left, the amount, today's weight, the wordmark) are Schibsted Grotesk, already shipped with the app.

| Role | Size / weight |
|---|---|
| Hero figure | 52 / 600 |
| Amount figure | 64 / 600 |
| Screen title | 28 / 700 |
| Meal heading | 20 / 600 |
| Body, row name | 17 / 400 |
| Second line | 15 / 400 |
| Small label, legend | 13 / 600 |

"Larger text" multiplies every size by 1.15.
Nothing a person has to read is smaller than 13 px.

Spacing is Astryx's scale in rem (4 px steps), so it grows with text size.
Screen side padding is 16 px.
Radius by role: 4 inside bars, 10 for keys and controls, 12 for grouped blocks, 16 for the top of a sheet.

- D1. Colours, sizes and spacing in components come from tokens only. A raw hex or px value outside the theme file fails the build check.
- D2. Rows, not cards: a list of things is edge-to-edge rows with hairlines inside one grouped block. Blocks never nest.
- D3. Colour is never the only signal. Over goal says "over"; an unrecognised word says "Not recognised".
- D4. The accent is scarce: Log, links, the selected thing, protein, the average line. Nothing decorative uses it.

### 7.2 Touch and motion

These are Astryx's measured rules, taken over as ours.

- T1. Every target is at least 44 by 44 px. A control that looks smaller grows an invisible touch area, stopping halfway to its neighbour.
- T2. Rows inside a scrolling list highlight 150 ms after touch-down and drop the highlight if the finger scrolls. A quick tap flashes for 100 ms on release. Keys and buttons outside scrolling lists highlight at once.
- T3. Movement past 10 px is a scroll, not a tap.
- T4. Hover styles sit inside `@media (hover: hover)` so nothing sticks after a tap.
- T5. Sheets slide up over 300 ms on the standard curve `cubic-bezier(0.24, 1, 0.4, 1)` and leave faster than they arrive. Taps that land while a sheet is still arriving do nothing.
- T6. A slow drag settles a sheet at the nearest stop; a fast flick down closes it. A sheet with unsaved entry (Food editor) ignores the flick.
- T7. With Reduce Motion on, nothing travels: changes cross-fade in 200 ms or less.
- T8. The swipe to delete always has a second way to do the same thing (Remove in the Amount sheet).
- T9. Destructive actions do not ask "are you sure". They happen, and a toast offers Undo for five seconds.
- T10. Heights use `dvh`, never `vh`; bars at the bottom add the home-indicator inset; toasts sit above the tab bar.
- T11. Numbers that change (calories left, the amount preview) change in place with no animation.

## 8. What changes outside the screens

Nothing in the data shape.
The backup format stays readable both ways.
`src/core/` gains one pure function, `usualFor(meal, entries, today)`, returning the foods most logged in that meal over 30 days, with tests.
Undo for delete and for quick-add is a new action pair (`deleteEntry` already returns the entry; add `restoreEntry`).
The Badging call for a missing weigh-in stays.

Hosting needs a decision before release.
The repository went private on 7 Nov and GitHub's free plan will not serve a private repository, so the app is offline for new installs.
Balu ruled on 10 Nov that v3 starts fresh: an empty diary and the same foods, imported from `private/macro-diary-foods.json`.
So the address can change freely, and nothing has to be carried over from the installed v2.

## 9. Proof

The standard is Astryx's: behaviour is measured, not asserted.

Automated, every build.
- Unit tests for `src/core/` unchanged, plus keypad rules and `usualFor`.
- A source check that fails on `<select`, `type="date"`, `type="number"`, a raw hex colour or px length outside the theme, and any field id or name matching the AutoFill words in K7.
- Playwright on WebKit at iPhone 15 size, light and dark: every screen in each of its five states; no sideways scroll at 375, 390 and 430 px; never more than one text field in the document; no element focused after opening any sheet; every target at least 44 px; log a meal by picking, by typed dictation and by simulated speech; edit, delete and undo; backup round trip; offline reload.
- One test with a shrunken visual viewport standing in for the keyboard: the focused field and the sheet's button stay visible and the page behind does not scroll.

On the phone, by Balu, because no simulator shows the real form bar.
- P0 probe before the build (section 11).
- A release checklist of ten taps, covering each of the five text fields in K3 and the keypad.

Review.
- `design-critique` and `review-animations` on screenshots of the built app against the mock.
- A reviewer pass over the whole change: personal data stays on the phone, no network calls, import cannot damage data.

## 10. How the build is handed to cheaper models

Borrowed from how Astryx makes itself usable by agents.

- `npx @astryxdesign/cli init` writes the component index into the repository's `AGENTS.md`, so Codex looks components up instead of guessing props.
- The brief for every job that touches a component starts with `npx @astryxdesign/cli component <Name> --dense`.
- This file is the long form. `DESIGN-V3.dense.md` is the same rules at one line each, and is what goes into every brief.
- Every source file opens with a three-line header: what it takes in, what it gives out, where it sits.
- Every local component has a doc file beside it: purpose, props, do and do not, the rule IDs it implements.
- The source check in section 9 runs in every job's "done when", so a model cannot finish with a raw colour or a native picker.

## 11. Tasks

The full breakdown, with subtasks and the model for each, is in [[projects/active/macro-diary/BUILD-TASKS-V3|BUILD-TASKS-V3.md]].
Seven waves: prove the ground on the phone, foundation, shared parts, screens, data and launch feel, proof, release.

## 12. Decisions

Settled by Balu on 10 Nov 2026, who gave the design to Fable: the screens are rebuilt on React 19 and Astryx, and the hero is the day line.
v3 starts with an empty diary and the same foods.
Still Balu's: where it is hosted (the repository is private, so it needs either a host that serves private repositories or to go public again), and the yes before anything is published.

## 13. The frame

What Balu saw on v2: scrolling too far makes the screen cut off at the bottom, and content slides up over the clock and battery.
The cause is that the whole page scrolls and bounces, and the bars are pinned to a page that moves.
v3 has no scrolling page at all.

- F1. The app is a fixed frame the size of the screen. The document itself never scrolls and never bounces.
- F2. The frame has three bands: a status band the height of the top inset, painted in the screen colour; the content; the bottom bar. They are siblings, so nothing can slide over another.
- F3. Each section has exactly one scrolling list, inside the content band. It bounces inside itself (`overscroll-behavior: contain`), so pulling past either end moves the list and nothing else.
- F4. Content never draws under the clock. The status band sits above the list, and the list's first row starts below it.
- F5. The bottom bar is outside the list and includes the home-indicator inset. The list's last row can always scroll clear of it.
- F6. Sheets are in the browser's top layer above the frame, and lock the list beneath while open.
- F7. Each section remembers its scroll position; tapping its tab again returns it to the top.
- F8. Turning the phone sideways is not supported; the app stays upright.

## 14. The 25 additions

The line for what gets in: it makes logging food or weight faster, makes the app feel instant and solid, or is something a stranger would need on day one.
Everything else stays out.

Feel and speed.

| # | Addition | What it means in use |
|---|---|---|
| A1 | Fixed frame | Section 13. Nothing cuts off, nothing slides over the clock. |
| A2 | Instant open | Today appears from a saved snapshot before storage has opened, behind a splash screen that matches light or dark, so there is no white flash and no loading line. |
| A3 | Only what changed redraws | Adding a food redraws one row and three figures, not the screen. Budget: under 100 ms from tap to change, tested. |
| A4 | Screen first, storage second | A tap shows its result at once; the write follows. If the write fails the change is undone and a toast says so. |
| A5 | No jumps | Every loading shape has the final size; nothing moves after it appears; only position and opacity animate. |
| A6 | Tap feel | A light haptic on keypad keys, the plus button and Log, using the one route iPhone Safari allows. Dropped if the probe shows it misfires. |
| A7 | Text size follows the iPhone | The app reads the phone's text-size setting; the manual "Larger text" switch goes. |
| A8 | Quiet updates | A new version loads itself the next time the app opens. No prompt in the middle of logging. |

Logging.

| # | Addition | What it means in use |
|---|---|---|
| A9 | Weight in two taps | The weigh-in sheet opens on yesterday's weight with minus and plus 0.1. Until today's weight is logged, the weight row is the first thing on Today. |
| A10 | Say your weight | "Weight 82.4" in the Log sheet. |
| A11 | Same as yesterday | The first row in Pick is yesterday's version of this meal, one tap to add all of it. |
| A12 | Saved meals you can build | Make and edit a saved meal directly ("100 g chicken, 200 g rice"), not only from a logged day. Add it at half, 1, one and a half or 2 times. Totals are worked out from the foods. |
| A13 | Named portions | A food can carry portions: "1 breast = 180 g", "1 cup cooked = 160 g". They show as the quick amounts on the keypad and work by voice. |
| A14 | Quick calories | For a meal out: a label, calories and optionally protein, with no food to create. |
| A15 | Move a food | "Move to Meal 3" in the Amount sheet. |
| A16 | Meal names | Keep Meal 1, 2, 3 or name them Breakfast, Lunch, Dinner, Snacks. Voice understands either. |
| A17 | Spoken fixes | "No, 200 grams", "remove the rice", "one and a half scoops". |
| A18 | Fix the food from the diary | "Edit this food" in the Amount sheet, for when a logged food's values turn out wrong. |

Foods.

| # | Addition | What it means in use |
|---|---|---|
| A19 | Starter foods | About 300 common New Zealand foods shipped inside the app and searchable offline, so a new person can log on day one. Your own foods always rank first and are marked as yours. The data source's licence is checked before it ships. |
| A20 | Enter it as the label prints it | Energy in kJ or kcal, values per 100 g or per serving. New Zealand labels print kJ; the app converts. |
| A21 | Forgiving search | Finds "chiken", "weetbix" and other names you have taught it, as you type. |

Trends.

| # | Addition | What it means in use |
|---|---|---|
| A22 | Goal weight | A line on the chart, kilograms to go, and the pace per week over the last 30 days. |
| A23 | Week average | The week strip shows the week's average calories and protein against the goal, which is the honest number on a cut. |

Trust.

| # | Addition | What it means in use |
|---|---|---|
| A24 | Data safety | The app asks the phone to keep its storage, shows when the last backup was, reminds after 14 days, saves a safety copy before any import, and exports to Files. |
| A25 | Ready for someone else | First run with no personal foods, kilograms or pounds, and one plain line on the Welcome screen: your diary never leaves this phone. |

Left out on purpose: barcode scanning and an online food database (the only feature that needs the internet, and the first thing to revisit if this is sold), exercise, water, micronutrients, streaks and badges, photos of meals, accounts and sync, social features, recipes from the web, ads.

## 15. If this is sold

A home-screen web app cannot be sold through the App Store and cannot remove the iOS form bar.
Wrapping the same v3 code in a thin native shell (Capacitor) does both: it becomes an App Store app, the form bar can be switched off outright, and it can write weight to Apple Health.
That needs an Apple developer account and a Mac or a cloud Mac build, and is a separate decision for after v3 has proved itself on Balu's phone.
Nothing in v3 blocks it.
