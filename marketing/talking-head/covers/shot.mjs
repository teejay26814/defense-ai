import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const exe = readdirSync(base).filter(n => n.startsWith('chromium-')).map(n => join(base, n, 'chrome-linux', 'chrome')).find(existsSync);
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const v of process.argv.slice(2)) {
  await p.goto(pathToFileURL(join(here, 'cover.html')).href + '?v=' + v);
  await p.waitForSelector('body[data-ready]');
  await p.screenshot({ path: join(here, `cover_${v}.png`) });
  console.log('cover', v);
}
await b.close();
