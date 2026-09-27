// Capture real Oppverse screens (public routes only) at 2x for the launch video.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'], proxy:{server:process.env.HTTPS_PROXY} });
const p = await b.newPage({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
for (const path of ['/', '/discover', '/app', '/signup', '/login']) {
  const r = await p.goto('https://oppverseai.vercel.app'+path, { waitUntil:'load', timeout:60000 });
  await p.waitForTimeout(3500);
  const name = path === '/' ? 'home' : path.slice(1);
  console.log(path, '->', r.status(), p.url(), (await p.title()));
  await p.screenshot({ path:`captures/${name}.png`, fullPage:true });
  const txt = await p.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log(txt.replace(/\n+/g,' | ').slice(0,900), '\n');
}
await b.close();
