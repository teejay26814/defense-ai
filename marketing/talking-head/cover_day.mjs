// Render a series cover: node cover_day.mjs <day> "<title>" out/<name>.png
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
const [day, title, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(pathToFileURL(process.cwd() + '/cover_day.html').href + `?day=${day}&title=${encodeURIComponent(title)}`);
await p.evaluate(async () => { await document.fonts.ready; });
await p.screenshot({ path: out }); await b.close();
