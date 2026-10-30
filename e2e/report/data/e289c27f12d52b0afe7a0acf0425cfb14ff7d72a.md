# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: diary.spec.mjs >> weigh-in row layout: label, input and Log sit on one compact line
- Location: tests\diary.spec.mjs:25:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 110
Received:   238.765625
```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - banner [ref=f1e3]:
    - generic [ref=f1e4]:
      - button "Previous day" [ref=f1e5] [cursor=pointer]
      - button "Today Sat 31 Oct" [ref=f1e8] [cursor=pointer]:
        - text: Today
        - generic [ref=f1e9]: Sat 31 Oct
      - button "Next day" [ref=f1e10] [cursor=pointer]
    - button "Settings" [ref=f1e13] [cursor=pointer]
  - main [ref=f1e16]:
    - generic [ref=f1e18]:
      - generic [ref=f1e19]: Morning weight
      - textbox "Morning weight in kg" [ref=f1e20]:
        - /placeholder: kg
        - text: "82.5"
      - generic [ref=f1e21]: kg
      - button "Log" [ref=f1e22] [cursor=pointer]
    - generic [ref=f1e23]:
      - generic [ref=f1e24]:
        - generic [ref=f1e25]: 2,400
        - generic [ref=f1e26]: Goal
      - generic [ref=f1e27]: −
      - generic [ref=f1e28]:
        - generic [ref=f1e29]: "0"
        - generic [ref=f1e30]: Food
      - generic [ref=f1e31]: =
      - generic [ref=f1e32]:
        - generic [ref=f1e33]: 2,400
        - generic [ref=f1e34]: Remaining
    - generic [ref=f1e35]:
      - generic [ref=f1e36]:
        - generic [ref=f1e37]: Protein
        - generic [ref=f1e38]: 0.0 / 180 g
      - generic [ref=f1e40]:
        - generic [ref=f1e41]: Carbs
        - generic [ref=f1e42]: 0.0 / 250 g
      - generic [ref=f1e44]:
        - generic [ref=f1e45]: Fat
        - generic [ref=f1e46]: 0.0 / 70 g
    - paragraph [ref=f1e49]: Nothing logged for Today.
    - generic [ref=f1e50]:
      - heading "Meal 1" [level=2] [ref=f1e52]
      - button "Add food" [ref=f1e54] [cursor=pointer]
  - button "Dictate" [ref=f1e56] [cursor=pointer]
  - navigation "Main navigation" [ref=f1e59]:
    - button "Diary" [ref=f1e60] [cursor=pointer]
    - button "Foods" [ref=f1e64] [cursor=pointer]
    - button "Weight" [ref=f1e68] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { openApp, FOODS, localDate, usualDay, expectFood, expectNoSideScroll } from './helpers.mjs';
  3  | 
  4  | test('first run shows an empty, usable diary', async ({ page }) => {
  5  |   const errors = await openApp(page);
  6  |   await expect(page.getByText(/Nothing logged for Today/)).toBeVisible();
  7  |   await expect(page.getByLabel('Morning weight in kg')).toBeVisible();
  8  |   await expect(page.getByRole('button', { name: /Dictate/ })).toBeVisible();
  9  |   await expectNoSideScroll(page);
  10 |   expect(errors).toEqual([]);
  11 | });
  12 | 
  13 | test('morning weigh-in is one tap: prefilled from yesterday, log, collapses, persists', async ({ page }) => {
  14 |   await openApp(page, { foods: FOODS, weights: [{ date: localDate(-8), kg: 83.0 }, { date: localDate(-1), kg: 82.5 }] });
  15 |   const input = page.getByLabel('Morning weight in kg');
  16 |   await expect(input).toHaveValue('82.5');
  17 |   await input.fill('82.1');
  18 |   await page.getByRole('button', { name: 'Log' }).click();
  19 |   await expect(page.locator('.weigh-in--done')).toContainText('82.1 kg');
  20 |   await expect(page.locator('.weigh-in--done')).toContainText('this week');
  21 |   await page.reload();
  22 |   await expect(page.locator('.weigh-in--done')).toContainText('82.1 kg');
  23 | });
  24 | 
  25 | test('weigh-in row layout: label, input and Log sit on one compact line', async ({ page }) => {
  26 |   await openApp(page, { foods: FOODS, weights: [{ date: localDate(-1), kg: 82.5 }] });
  27 |   const box = await page.locator('.weigh-in').boundingBox();
> 28 |   expect(box.height).toBeLessThan(110);
     |                      ^ Error: expect(received).toBeLessThan(expected)
  29 |   const log = await page.getByRole('button', { name: 'Log' }).boundingBox();
  30 |   expect(log.height).toBeLessThan(60);
  31 | });
  32 | 
  33 | test('add a food by tapping: search, quantity, totals update', async ({ page }) => {
  34 |   await openApp(page, { foods: FOODS });
  35 |   await page.getByRole('button', { name: 'Add food' }).first().click();
  36 |   await page.locator('.sheet input').first().fill('chick');
  37 |   await page.locator('.sheet').getByText('Chicken breast').click();
  38 |   await page.locator('.sheet input').first().fill('125');
  39 |   await page.locator('.sheet').getByRole('button', { name: 'Add', exact: true }).click();
  40 |   await expect(page.locator('main .section').first()).toContainText('Chicken breast');
  41 |   await expectFood(page, '206');
  42 | });
  43 | 
  44 | test('copy yesterday fills an empty day in one tap', async ({ page }) => {
  45 |   await openApp(page, { foods: FOODS, entries: usualDay(localDate(-1)) });
  46 |   await page.locator('.dock').getByRole('button', { name: /Copy/ }).click();
  47 |   await expect(page.locator('main .section .row')).toHaveCount(6);
  48 |   await expectFood(page, '839');
  49 |   await expect(page.locator('.dock').getByRole('button', { name: /Copy/ })).toHaveCount(0);
  50 | });
  51 | 
  52 | test('copy a single meal from an earlier day', async ({ page }) => {
  53 |   const today = localDate();
  54 |   await openApp(page, { foods: FOODS, entries: [...usualDay(localDate(-1)), ...usualDay(today).slice(0, 3)] });
  55 |   // Meal 2 is missing today: the next-meal block offers to copy it from yesterday.
  56 |   await page.getByRole('button', { name: /Copy Meal 2 from Yesterday/ }).click();
  57 |   await expectFood(page, '839');
  58 | });
  59 | 
  60 | test('edit and delete an entry', async ({ page }) => {
  61 |   await openApp(page, { foods: FOODS, entries: usualDay(localDate()) });
  62 |   await page.locator('main .row', { hasText: 'Chicken breast' }).click();
  63 |   await page.locator('.sheet input').first().fill('200');
  64 |   await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  65 |   await expectFood(page, '963');
  66 |   await page.locator('main .row', { hasText: 'Cashews' }).click();
  67 |   await page.locator('.sheet').getByRole('button', { name: 'Delete' }).click();
  68 |   await expectFood(page, '847');
  69 | });
  70 | 
  71 | test('date navigation and data survive a reload', async ({ page }) => {
  72 |   await openApp(page, { foods: FOODS, entries: usualDay(localDate(-1)) });
  73 |   await page.getByRole('button', { name: 'Previous day' }).click();
  74 |   await expect(page.locator('.topbar')).toContainText('Yesterday');
  75 |   await expectFood(page, '839');
  76 |   await page.reload();
  77 |   await page.getByRole('button', { name: 'Previous day' }).click();
  78 |   await expectFood(page, '839');
  79 | });
  80 | 
  81 | for (const width of [375, 390, 430]) {
  82 |   test(`no sideways scroll at ${width}px on every tab`, async ({ page }) => {
  83 |     await page.setViewportSize({ width, height: 844 });
  84 |     await openApp(page, { foods: FOODS, entries: usualDay(localDate()), weights: [{ date: localDate(), kg: 82.4 }] });
  85 |     for (const tab of ['Diary', 'Foods', 'Weight']) {
  86 |       await page.locator('.tabbar').getByRole('button', { name: tab }).click();
  87 |       await expectNoSideScroll(page);
  88 |     }
  89 |   });
  90 | }
  91 | 
```