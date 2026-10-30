// Stitches PNGs from a folder into contact sheets: node contact.mjs <dir> <perSheet>
import { webkit } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
const [dir, per = '7'] = process.argv.slice(2);
const files = readdirSync(dir).filter(f => /^\d.*\.png$/.test(f)).sort();
const b = await webkit.launch();
for (let s = 0; s * per < files.length; s++) {
  const group = files.slice(s * per, (s + 1) * per);
  const cells = group.map(f => `<figure><img src="data:image/png;base64,${readFileSync(`${dir}/${f}`).toString('base64')}"><figcaption>${f}</figcaption></figure>`).join('');
  const p = await b.newPage({ viewport: { width: 1800, height: 900 } });
  await p.setContent(`<style>body{margin:0;background:#333;display:flex;gap:8px;padding:8px;font:14px sans-serif;color:#fff}figure{margin:0}img{width:250px;display:block}</style>${cells}`);
  await p.screenshot({ path: `${dir}/sheet-${s + 1}.png`, fullPage: true });
  await p.close();
}
await b.close();
