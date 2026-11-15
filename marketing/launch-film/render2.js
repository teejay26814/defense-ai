// Frame-exact renderer: calls window.render(t) for every frame and screenshots it.
// usage: node render.js <W> <H> <out dir> [fps] [only-times comma list for previews]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [W, H, OUT, FPS = '30', ONLY] = process.argv.slice(2);
  const fps = Number(FPS), DUR = Number(process.env.DUR || 38.5);
  fs.mkdirSync(OUT, { recursive: true });
  const html = fs.readFileSync(path.join(__dirname, process.env.FILM || 'film.html'), 'utf8')
    .replace('__MARK__', fs.readFileSync(path.join(__dirname, 'assets/mark.svg'), 'utf8').replace(/`/g, ''));
  fs.writeFileSync(path.join(__dirname, '_' + (process.env.FILM || 'film.html')), html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: Number(process.env.DPR || 1) });
  await p.goto('file://' + path.join(__dirname, '_' + (process.env.FILM || 'film.html')), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const times = ONLY ? ONLY.split(',').map(Number) : Array.from({ length: Math.round(DUR * fps) }, (_, i) => i / fps);
  let i = 0;
  for (const t of times) {
    await p.evaluate((t) => window.render(t), t);
    const name = ONLY ? `t_${String(t).replace('.', '_')}.jpg` : String(i).padStart(5, '0') + '.jpg';
    await p.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: Number(process.env.Q || 93) });
    i++;
    if (!ONLY && i % 150 === 0) console.log(`  ${i}/${times.length}`);
  }
  await b.close();
  console.log('rendered', i, 'frames');
})();
