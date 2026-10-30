// Ad-hoc screenshot helper: node shot.mjs <url> <out.png> [js-to-run-before-shot]
import { webkit, devices } from '@playwright/test';
const [url, out, script] = process.argv.slice(2);
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'], colorScheme: 'dark' });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
p.on('pageerror', e => logs.push(`pageerror: ${e.message}`));
await p.goto(url);
await p.waitForTimeout(800);
if (script) { await p.evaluate(script); await p.waitForTimeout(500); }
await p.screenshot({ path: out, fullPage: false });
console.log(JSON.stringify({ logs, overflow: await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) }));
await b.close();
