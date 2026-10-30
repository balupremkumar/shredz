// Renders the install QR code for the live URL: node make-qr.mjs <url>
import { webkit } from '@playwright/test';
const url = process.argv[2];
const b = await webkit.launch();
const p = await b.newPage({ viewport: { width: 420, height: 420 } });
await p.setContent('<body style="margin:0;background:#fff;display:grid;place-items:center;height:100vh"><div id="q"></div></body>');
await p.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js' });
await p.evaluate(u => { const q = qrcode(0, 'M'); q.addData(u); q.make(); document.getElementById('q').innerHTML = q.createSvgTag({ cellSize: 10, margin: 4 }); }, url);
await p.locator('#q svg').screenshot({ path: new URL('../icons/install-qr.png', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });
await b.close();
console.log('qr for', url);
