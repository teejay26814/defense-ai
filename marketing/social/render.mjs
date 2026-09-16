// Render #card in composition.html to a single PNG using the headless Chromium in this image.
//   node render.mjs
// Output: out/post.png at 2x (2160x2160). No API, no credits.

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, readdirSync } from 'node:fs';
import { existsSync, readdirSync as readdirSyncFs } from 'node:fs';
import { mkdir as mkdirp } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out');
const SCALE = 2;

function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const name of readdirSyncFs(base)) {
      if (name.startsWith('chromium-')) {
        const p = join(base, name, 'chrome-linux', 'chrome');
        if (existsSync(p)) return p;
      }
    }
  } catch {}
  return undefined;
}

const run = async () => {
  await mkdirp(outDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'],
  });
  const page = await browser.newPage({ deviceScaleFactor: SCALE });
  const comp = process.argv[2] || 'composition.html';
  const outName = process.argv[3] || 'post.png';
  await page.goto(pathToFileURL(join(here, comp)).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; });

  const card = await page.$('#card');
  if (!card) throw new Error('#card not found');
  const file = join(outDir, outName);
  await card.screenshot({ path: file });
  console.log('rendered ' + file);
  await browser.close();
};

run().catch((e) => { console.error(e); process.exit(1); });
