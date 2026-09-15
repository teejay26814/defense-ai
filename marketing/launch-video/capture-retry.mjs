import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'captures');
const BASE = 'https://academia-scribes.netlify.app';
const EMAIL = process.env.AS_EMAIL, PASS = process.env.AS_PASS;
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const PID = 'f9aa3aa0-160d-4572-b564-823469c09c59';
function exe(){const b='/opt/pw-browsers';for(const n of readdirSync(b))if(n.startsWith('chromium-')){const p=join(b,n,'chrome-linux','chrome');if(existsSync(p))return p;}}

const b = await chromium.launch({ executablePath: exe(), args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'], proxy: PROXY?{server:PROXY}:undefined });
const ctx = await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`,{waitUntil:'networkidle',timeout:60000});
await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASS);
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{});
await page.waitForTimeout(2000); console.log('logged in');
const P = `${BASE}/projects/${PID}`;

// FLASHCARD via /questions
try{
  await page.goto(`${P}/questions`,{waitUntil:'networkidle',timeout:60000});
  await page.waitForTimeout(1500);
  const rev = page.locator('text=/Tap the card to reveal|Show what my project says|tap to reveal/i').first();
  if(await rev.count()){ await rev.click(); } else { await page.locator('body').click(); await page.keyboard.press('Space'); }
  await page.waitForTimeout(1600);
  await page.screenshot({path:join(OUT,'05-flashcard-revealed.png'),fullPage:true});
  console.log('  flashcard shot');
}catch(e){ console.log('flashcard err', e.message.split('\n')[0]); }

// ASK — fill + submit, poll for answer up to 150s
try{
  await page.goto(`${P}/ask`,{waitUntil:'networkidle',timeout:60000});
  await page.waitForTimeout(1200);
  await page.fill('textarea','What are the limitations of my study?');
  await page.locator('button:has-text("Ask my project")').first().click();
  console.log('  asked, polling…');
  let done=false;
  for(let i=0;i<50 && !done;i++){
    await page.waitForTimeout(3000);
    const hasAnswer = await page.locator('text=/^Answer$/i, text=/From your project/i').count().catch(()=>0);
    const hasErr = await page.locator('text=/something went wrong|could not|error|try again/i').count().catch(()=>0);
    const bodyLen = await page.evaluate(()=>document.body.innerText.length);
    if(hasAnswer>0){ done=true; console.log('  answer detected at', (i+1)*3,'s'); }
    else if(hasErr>0){ console.log('  error state at',(i+1)*3,'s'); done=true; }
    if(i%3===0) console.log('   …waiting', (i+1)*3,'s bodyLen',bodyLen);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({path:join(OUT,'04-ask-answer.png'),fullPage:true});
  console.log('  ask shot');
}catch(e){ console.log('ask err', e.message.split('\n')[0]); }

await b.close(); console.log('done');
