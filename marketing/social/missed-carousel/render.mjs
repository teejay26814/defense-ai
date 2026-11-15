// Render each .slide in composition.html to a PNG, using the headless Chromium already
// installed in this environment. No browser download, no API, no credits.
//
//   npm run render
//
// Output: out/slide-01.png ... out/slide-07.png at 1080x1350 (Instagram / LinkedIn 4:5).
// Fonts are the real brand faces from ./fonts, embedded via ./fonts.css, and we wait for
// document.fonts.ready before shooting, so no slide can render with fallback type.

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out');

// Locate the Chromium that ships in this image (Playwright browsers path).
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const candidates = [];
  try {
    for (const name of require('node:fs').readdirSync(base)) {
      if (name.startsWith('chromium-')) {
        candidates.push(join(base, name, 'chrome-linux', 'chrome'));
      }
    }
  } catch {}
  return candidates.find((p) => existsSync(p));
}

const SCALE = 2; // 2x device pixels -> crisp 2160x2700 exports that downscale cleanly

const run = async () => {
  await mkdir(outDir, { recursive: true });

  const executablePath = findChromium();
  const browser = await chromium.launch({
    executablePath, // undefined falls back to Playwright's own resolution
    args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'],
  });

  const page = await browser.newPage({ deviceScaleFactor: SCALE });
  const url = pathToFileURL(join(here, 'composition.html')).href;
  await page.goto(url, { waitUntil: 'networkidle' });

  // Guarantee the brand fonts are decoded before any screenshot is taken.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const slides = await page.$$('.slide');
  if (slides.length === 0) throw new Error('No .slide elements found in composition.html');

  let i = 0;
  for (const slide of slides) {
    i += 1;
    const file = join(outDir, `slide-${String(i).padStart(2, '0')}.png`);
    await slide.screenshot({ path: file });
    console.log(`  rendered ${file}`);
  }

  await browser.close();
  console.log(`\nDone. ${i} slide${i === 1 ? '' : 's'} in ${outDir}`);
};

// tiny CommonJS shim so findChromium can use require() under ESM
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
