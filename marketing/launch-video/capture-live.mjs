// Capture the REAL running app for the launch video.
//
// Requires a cloud environment whose Network access allows:
//     academia-scribes.netlify.app
//     *.supabase.co
// (Custom allowlist, or Full). At the default "Trusted" level this fails with a
// proxy 403 / ERR_TUNNEL_CONNECTION_FAILED, because the live site and Supabase
// are not on the trusted list.
//
// Credentials are read from the environment, never hard-coded:
//     AS_EMAIL=you@example.com AS_PASS=yourpassword node capture-live.mjs
//
// Screens land in ./captures as high-res PNGs, ready to animate.
import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'captures');
mkdirSync(OUT, { recursive: true });

const BASE = process.env.AS_BASE || 'https://academia-scribes.netlify.app';
const EMAIL = process.env.AS_EMAIL;
const PASS = process.env.AS_PASS;
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
if (!EMAIL || !PASS) { console.error('Set AS_EMAIL and AS_PASS env vars.'); process.exit(1); }

function chromiumExe() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const n of readdirSync(base)) if (n.startsWith('chromium-')) {
    const p = join(base, n, 'chrome-linux', 'chrome'); if (existsSync(p)) return p;
  }
}

const shot = async (page, name, full = true) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });
  console.log('captured', name, '->', page.url());
};

const b = await chromium.launch({
  executablePath: chromiumExe(),
  args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'],
  proxy: PROXY ? { server: PROXY } : undefined,
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// ---- log in ----
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);   // let the form hydrate, or typed values are lost
await page.locator('input[type="email"]').pressSequentially(EMAIL, { delay: 10 });
await page.locator('input[type="password"]').pressSequentially(PASS, { delay: 10 });
await page.getByRole('button', { name: /^Sign in/ }).last().click();
await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => console.log('login did not leave /login'));
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(2500);
console.log('logged in ->', page.url());

// ---- dashboard ----
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 60000 });
await shot(page, '01-dashboard');

// ---- projects list, and discover the project id ----
await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle', timeout: 60000 });
await shot(page, '02-projects');
const hrefs = await page.$$eval('a[href*="/projects/"]', els => els.map(e => e.getAttribute('href')));
const projHref = [...new Set(hrefs)].find(h => /\/projects\/[0-9a-f-]{8,}/.test(h));
const pid = projHref ? projHref.split('/projects/')[1].split('/')[0] : null;
console.log('project id:', pid);

if (pid) {
  const P = `${BASE}/projects/${pid}`;
  const pages = [
    ['03-project', P],
    ['04-ask', `${P}/ask`],
    ['05-questions', `${P}/questions`],
    ['06-quiz', `${P}/quiz`],
    ['07-mnemonics', `${P}/mnemonics`],
    ['08-defense', `${P}/defense`],
  ];
  for (const [name, url] of pages) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('nav fail', url, e.message));
    await shot(page, name);
  }
}

await b.close();
console.log('done -> captures/');
