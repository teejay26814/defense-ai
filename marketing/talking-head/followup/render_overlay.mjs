// Render explainer/overlay.html to a transparent PNG sequence, deterministic per frame.
//   node explainer/render_overlay.mjs <outdir>             all frames + cues.json
//   node explainer/render_overlay.mjs <outdir> --probe 3 12 on a grey backdrop, for checking
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const [outDir, flag, ...rest] = process.argv.slice(2);
const probe = flag === '--probe' ? rest.map(Number) : null;
mkdirSync(outDir, { recursive: true });
const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const exe = readdirSync(base).filter(n => n.startsWith('chromium-')).map(n => join(base, n, 'chrome-linux', 'chrome')).find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
async function open() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto(pathToFileURL(join(here, process.env.OVERLAY || 'overlay.html')).href, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.ready; });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: probe && process.env.PROBE_BG ? { r: 90, g: 96, b: 110, a: 1 } : { r: 0, g: 0, b: 0, a: 0 } });
  const seek = s => page.evaluate(s => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = s * 1000; } return new Promise(r => requestAnimationFrame(() => r())); }, s);
  const shot = async p => { const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }); writeFileSync(p, Buffer.from(r.data, 'base64')); };
  return { page, seek, shot };
}
const w0 = await open();
const dur = await w0.page.evaluate(() => +document.getElementById('stage').dataset.duration);
writeFileSync(join(outDir, 'cues.json'), JSON.stringify(await w0.page.evaluate(() => window.__cues)));
if (probe) { for (const s of probe) { await w0.seek(s); await w0.shot(join(outDir, `p_${s.toFixed(2)}.png`)); } await browser.close(); process.exit(0); }
const total = Math.round(dur * 30), W = 4, ws = [w0];
for (let i = 1; i < W; i++) ws.push(await open());
let done = 0;
await Promise.all(ws.map(async (wk, k) => { for (let i = k; i < total; i += W) {
  await wk.seek(i / 30); await wk.shot(join(outDir, `f_${String(i).padStart(5, '0')}.png`));
  if (++done % 300 === 0) console.log(`  ${done}/${total}`); } }));
await browser.close(); console.log('frames:', total);
