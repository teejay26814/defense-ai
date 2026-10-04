// Deterministic HTML -> MP4 renderer for the Academia Scribes story cut.
// Every frame: seek all WAAPI/CSS animations to t, call window.__seek(t) for the
// JS-driven layers (orbit, fragments, grain), then screenshot the stage.
//   node render.mjs                         full render -> oppverse-launch.mp4
//   node render.mjs --probe 3.2 10.6 25     stills -> probe/t_3.20.png ...
//   FPS=60 node render.mjs                  override the composition's fps
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const probe = args[0] === '--probe' ? args.slice(1).map(Number) : null;
const comp = process.env.COMP || 'story.html';
const out = join(here, process.env.OUT || 'story-silent.mp4');
const framesDir = join(here, process.env.VERT ? 'frames-v' : 'frames');
const [VW, VH] = process.env.VERT ? [1080, 1920] : [1920, 1080];

function chromiumExe() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const n of readdirSync(base)) if (n.startsWith('chromium-')) {
    const p = join(base, n, 'chrome-linux', 'chrome'); if (existsSync(p)) return p;
  }
}
const ffmpeg = () => execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

const browser = await chromium.launch({ executablePath: chromiumExe(), args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
const scale = +(process.env.SCALE || 1);
async function openPage() {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: scale });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto(pathToFileURL(join(here, comp)).href + (process.env.VERT ? '?render&vert' : '?render'), { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; });
  const cdp = await page.context().newCDPSession(page);
  const seek = (s) => page.evaluate((s) => {
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = s * 1000; } catch (e) {} }
    if (window.__seek) window.__seek(s);
    return new Promise(r => requestAnimationFrame(() => r()));
  }, s);
  // CDP capture with fast (lossless) PNG encoding: ~4x quicker than locator screenshots
  const shot = async (path) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: VW, height: VH, scale: 1 } });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  };
  return { page, seek, shot };
}

const first = await openPage();
const meta = await first.page.$eval('#stage', el => ({ fps: +el.dataset.fps, dur: +el.dataset.duration }));
const fps = +(process.env.FPS || meta.fps);

if (probe) {
  mkdirSync(join(here, 'probe'), { recursive: true });
  const pfx = process.env.VERT ? 'v_' : 't_';
  for (const s of probe) {
    await first.seek(s);
    await first.shot(join(here, 'probe', `${pfx}${s.toFixed(2)}.png`));
    console.log('probe', s);
  }
  await browser.close();
  process.exit(0);
}

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
const total = Math.round(fps * meta.dur);
const W = +(process.env.WORKERS || 3);
console.log(`rendering ${total} frames @ ${fps}fps (${meta.dur}s) on ${W} workers`);
const workers = [first];
for (let w = 1; w < W; w++) workers.push(await openPage());
let done = 0;
await Promise.all(workers.map(async (wk, w) => {
  for (let i = w; i < total; i += W) {
    await wk.seek(i / fps);
    await wk.shot(join(framesDir, `f_${String(i).padStart(5, '0')}.png`));
    if (++done % (fps * 4) === 0) console.log(`  ${done}/${total}`);
  }
}));
await browser.close();

console.log('encoding...');
execFileSync(ffmpeg(), [
  '-y', '-framerate', String(fps), '-i', join(framesDir, 'f_%05d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-tune', 'film',
  '-movflags', '+faststart', out,
], { stdio: 'inherit' });
rmSync(framesDir, { recursive: true, force: true });
console.log('done ->', out);
