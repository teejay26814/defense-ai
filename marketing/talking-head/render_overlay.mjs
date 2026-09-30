// Render overlay.html to transparent PNG frames.
//   node render_overlay.mjs work/<name>.data.js work/<name>_ov [--probe 3.2 9.5]
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, rmSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const [dataJs, outDir] = [resolve(process.argv[2]), resolve(process.argv[3])];
const probe = process.argv.includes('--probe') ? process.argv.slice(process.argv.indexOf('--probe') + 1).map(Number) : null;
const FPS = 30;
const exe = (() => { const b = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const n of readdirSync(b)) if (n.startsWith('chromium-')) { const p = join(b, n, 'chrome-linux', 'chrome'); if (existsSync(p)) return p; } })();

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
async function open() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto(pathToFileURL(join(here, 'overlay.html')).href + '?data=' + encodeURIComponent(pathToFileURL(dataJs).href));
  await page.evaluate(async () => { await window.__ready; await document.fonts.ready; });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const shot = async (t, path) => {
    await page.evaluate((t) => { window.__seek(t); return new Promise(r => requestAnimationFrame(() => r())); }, t);
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 } });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  };
  return { page, shot };
}
const first = await open();
if (probe) {
  mkdirSync(outDir, { recursive: true });
  for (const t of probe) { await first.shot(t, join(outDir, `p_${t.toFixed(2)}.png`)); }
  await browser.close(); process.exit(0);
}
const dur = await first.page.evaluate(() => window.EDIT.dur);
const total = Math.round(dur * FPS);
rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true });
const workers = [first, await open(), await open()];
await Promise.all(workers.map(async (w, k) => {
  for (let i = k; i < total; i += workers.length) await w.shot(i / FPS, join(outDir, `f_${String(i).padStart(5, '0')}.png`));
}));
await browser.close();
console.log(`overlay: ${total} frames -> ${outDir}`);
