// Render composition.html to MP4 locally. Chromium seeks every CSS animation to each
// frame's moment and screenshots the stage; imageio-ffmpeg encodes. No API, no credits.
//   node render.mjs [composition.html] [out.mp4] [width] [height]
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const comp = process.argv[2] || 'composition.html';
const out = join(here, process.argv[3] || 'launch-landscape.mp4');
const W = +(process.argv[4] || 1280);
const H = +(process.argv[5] || 720);
const framesDir = join(here, 'frames');

function chromiumExe() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const n of readdirSync(base)) if (n.startsWith('chromium-')) {
    const p = join(base, n, 'chrome-linux', 'chrome'); if (existsSync(p)) return p;
  }
}
function ffmpegExe() {
  return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
}

const run = async () => {
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: chromiumExe(), args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const scale = +(process.env.SCALE || 1.5);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(join(here, comp)).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; });

  const meta = await page.$eval('#stage', el => ({ fps: +el.dataset.fps, dur: +el.dataset.duration }));
  const total = Math.round(meta.fps * meta.dur);
  const stage = await page.$('#stage');
  console.log(`rendering ${total} frames @ ${meta.fps}fps (${meta.dur}s) ${W}x${H}`);

  for (let i = 0; i < total; i++) {
    const t = (i / meta.fps) * 1000;
    await page.evaluate((ms) => {
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = ms; } catch (e) {} }
    }, t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await stage.screenshot({ path: join(framesDir, `f_${String(i).padStart(5, '0')}.png`) });
    if (i % 30 === 0) { process.stdout.write(`  ${i}/${total}\n`); }
  }
  await browser.close();

  console.log('encoding...');
  execFileSync(ffmpegExe(), [
    '-y', '-framerate', String(meta.fps), '-i', join(framesDir, 'f_%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
    '-movflags', '+faststart', out,
  ], { stdio: 'inherit' });

  rmSync(framesDir, { recursive: true, force: true });
  console.log('done ->', out);
};
run().catch(e => { console.error(e); process.exit(1); });
