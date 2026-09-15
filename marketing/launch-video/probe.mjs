import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const comp = process.argv[2] || 'composition.html';
const W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720);
const times = (process.argv[5] || '2,6.6,11,16,21,27,30.5').split(',').map(Number);
const outDir = join(here, 'probe'); mkdirSync(outDir, { recursive: true });

function chromiumExe(){const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';for(const n of readdirSync(base))if(n.startsWith('chromium-')){const p=join(base,n,'chrome-linux','chrome');if(existsSync(p))return p;}}

const b = await chromium.launch({ executablePath: chromiumExe(), args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });
const page = await b.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
await page.goto(pathToFileURL(join(here,comp)).href,{waitUntil:'networkidle'});
await page.evaluate(async()=>{await document.fonts.ready;});
const stage = await page.$('#stage');
for(const s of times){
  await page.evaluate((ms)=>{for(const a of document.getAnimations()){try{a.pause();a.currentTime=ms;}catch(e){}}}, s*1000);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await stage.screenshot({ path: join(outDir, `t_${String(s).replace('.','_')}s.png`) });
  console.log('shot', s);
}
await b.close();
