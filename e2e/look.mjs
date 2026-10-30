// Quick visual: node look.mjs <out-prefix>
import { webkit, devices } from '@playwright/test';
import { seed, localDate } from './fixtures.mjs';
const out = process.argv[2];
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'], colorScheme: 'dark' });
const p = await ctx.newPage();
const logs = [];
p.on('pageerror', e => logs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
await p.goto('http://127.0.0.1:8137/index.html');
await p.waitForSelector('.tabbar .tab');
const y = localDate(-1), t = localDate(0);
const e = (id, date, meal, foodId, qty) => ({ id, date, meal, foodId, qty });
await seed(p, {
  entries: [e('a', y, 1, 'wb', 2), e('b', y, 1, 'gm', 200), e('c', y, 1, 'wp', 1), e('d', y, 2, 'cb', 125), e('f', y, 2, 'br', 150), e('g', y, 2, 'cs', 20),
            e('h', t, 1, 'wb', 2), e('i', t, 1, 'gm', 200), e('j', t, 1, 'wp', 1), e('k', t, 2, 'cb', 125)],
  weights: [{ date: localDate(-8), kg: 83.0 }, { date: y, kg: 82.5 }],
});
await p.screenshot({ path: `${out}-diary.png` });
await p.click('text=Foods');
await p.screenshot({ path: `${out}-foods.png` });
console.log(JSON.stringify({ logs, overflow: await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) }));
await b.close();
