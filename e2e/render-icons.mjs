// Renders icons/icon.svg to the PNG sizes the PWA needs: node render-icons.mjs
import { webkit } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const b = await webkit.launch();
for (const size of [180, 192, 512]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:#05080E">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: new URL(`../icons/icon-${size}.png`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });
  await p.close();
}
await b.close();
console.log('rendered 180, 192, 512');
