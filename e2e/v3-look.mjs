// Ad-hoc look at the v3 build in WebKit at iPhone 15 size: node v3-look.mjs <url> <outDir>
// One browser launch for every shot (see brain/risks.md, Security item 9).
import { webkit, devices } from '@playwright/test';

const [url, out] = process.argv.slice(2);
const browser = await webkit.launch();
const report = [];
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({ ...devices['iPhone 15'], colorScheme: scheme });
  const page = await context.newPage();
  const logs = [];
  page.on('console', message => { if (message.type() === 'error') logs.push(message.text()); });
  page.on('pageerror', error => logs.push(`pageerror: ${error.message}`));
  await page.goto(url);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/v3-${scheme}-home.png` });
  // F1: the document must not scroll, only the list.
  const frame = await page.evaluate(() => {
    const list = document.querySelector('.frame__list');
    list.scrollTop = 99999;
    window.scrollTo(0, 500);
    return { docScroll: window.scrollY, listScroll: list.scrollTop, sideways: document.documentElement.scrollWidth - innerWidth,
      barBottom: Math.round(document.querySelector('.tabbar').getBoundingClientRect().bottom), viewport: innerHeight };
  });
  await page.evaluate(() => { document.querySelector('.frame__list').scrollTop = 0; });
  await page.getByRole('button', { name: /5\. Shredz keypad/ }).tap();
  await page.waitForTimeout(700);
  for (const key of ['2', '0', '0']) await page.getByRole('button', { name: key, exact: true }).tap();
  const keypad = await page.evaluate(() => ({
    inputs: document.querySelectorAll('input, textarea, select').length,
    amount: document.querySelector('.amount__value')?.textContent,
    focused: document.activeElement?.tagName,
  }));
  await page.screenshot({ path: `${out}/v3-${scheme}-keypad.png` });
  await page.getByRole('button', { name: 'Close' }).tap();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /3\. Search field/ }).tap();
  await page.waitForTimeout(700);
  const search = await page.evaluate(() => ({ focused: document.activeElement?.tagName, textFields: document.querySelectorAll('input, textarea').length }));
  await page.screenshot({ path: `${out}/v3-${scheme}-search.png` });
  report.push({ scheme, frame, keypad, search, logs });
  await context.close();
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
