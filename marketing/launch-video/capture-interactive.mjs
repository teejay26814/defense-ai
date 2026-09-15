// Second capture pass: drive the real app so screens show live state, not empty
// forms. Answer an Ask question, reveal a flashcard, answer a quiz item, open the
// mock-defense sitting. Each step is isolated so one failure doesn't lose the rest.
//   AS_EMAIL=… AS_PASS=… node capture-interactive.mjs
import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'captures'); mkdirSync(OUT, { recursive: true });
const BASE = process.env.AS_BASE || 'https://academia-scribes.netlify.app';
const EMAIL = process.env.AS_EMAIL, PASS = process.env.AS_PASS;
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const PID = 'f9aa3aa0-160d-4572-b564-823469c09c59';
if (!EMAIL || !PASS) { console.error('Set AS_EMAIL and AS_PASS'); process.exit(1); }

function exe(){const b=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';for(const n of readdirSync(b))if(n.startsWith('chromium-')){const p=join(b,n,'chrome-linux','chrome');if(existsSync(p))return p;}}
const shot = async (page, name) => { await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true }); console.log('  shot', name); };

const b = await chromium.launch({ executablePath: exe(), args: ['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'], proxy: PROXY ? { server: PROXY } : undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(2000);
console.log('logged in');

const P = `${BASE}/projects/${PID}`;

// 1. ASK — submit an example question, wait for the grounded answer
try {
  await page.goto(`${P}/ask`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  const chip = page.locator('button:has-text("What are the limitations of my study?")').first();
  await chip.click();
  console.log('  asked; waiting for answer…');
  // answer arrives via n8n; wait for the "Answer" heading or long text
  await page.waitForSelector('text=/Answer/i', { timeout: 90000 }).catch(()=>{});
  await page.waitForTimeout(2500);
  await shot(page, '04-ask-answer');
} catch (e) { console.log('  ask failed:', e.message.split('\n')[0]); }

// 2. FLASHCARDS — reveal the card
try {
  await page.goto(`${P}/flashcards`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  // click the reveal control / card
  const reveal = page.locator('text=/Tap the card to reveal|Show what my project says/i').first();
  if (await reveal.count()) await reveal.click(); else await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  await shot(page, '05-flashcard-revealed');
} catch (e) { console.log('  flashcard failed:', e.message.split('\n')[0]); }

// 3. QUIZ — pick the correct option to show the answered state + source
try {
  await page.goto(`${P}/quiz`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  const correct = page.locator('button:has-text("assess the knowledge of neonatal jaundice among women attending")').first();
  if (await correct.count()) await correct.click();
  else await page.locator('ul li button, [role="button"]').nth(3).click().catch(()=>{});
  await page.waitForTimeout(1800);
  await shot(page, '06-quiz-answered');
} catch (e) { console.log('  quiz failed:', e.message.split('\n')[0]); }

// 4. MOCK DEFENSE — open the sitting, type an answer (do not submit)
try {
  await page.goto(`${P}/defense`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  const cont = page.locator('a:has-text("Continue it"), button:has-text("Continue it"), a:has-text("Start"), button:has-text("Start")').first();
  if (await cont.count()) { await cont.click(); await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); }
  await page.waitForTimeout(1800);
  const ta = page.locator('textarea').first();
  if (await ta.count()) {
    await ta.fill('It let me measure knowledge, perceived risk factors and information sources among the antenatal women at a single point in time, which is exactly what the study objectives called for.');
  }
  await page.waitForTimeout(800);
  await shot(page, '08-defense-sitting');
} catch (e) { console.log('  defense failed:', e.message.split('\n')[0]); }

await b.close();
console.log('done');
