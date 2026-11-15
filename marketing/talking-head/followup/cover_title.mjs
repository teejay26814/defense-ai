// The hook's title layer alone (captions hidden), transparent, at time t -> PNG
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url)); const [t, out] = process.argv.slice(2);
const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const exe = readdirSync(base).filter(n => n.startsWith('chromium-')).map(n => join(base, n, 'chrome-linux', 'chrome')).find(existsSync);
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(pathToFileURL(join(here, process.env.OVERLAY || 'overlay.html')).href); await p.evaluate(async () => { await document.fonts.ready; });
const cdp = await p.context().newCDPSession(p);
await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await p.evaluate(s => { document.getElementById('cap').style.display = 'none'; for (const a of document.getAnimations()) { a.pause(); a.currentTime = s * 1000; } }, +t);
const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(out, Buffer.from(r.data, 'base64')); await b.close();
