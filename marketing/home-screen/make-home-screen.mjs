// Renders the Home screen for social posts: the real, signed-in web build in
// three states, each in the shared phone frame on the calm brand background
// (../shared/brand-frame.mjs), like every other export.
//
// Outputs (in this folder), all 1080x1350:
//   home-in-progress.png   3 of 5 steps done, estimated tax, past years
//   home-not-started.png   nothing filed yet
//   home-completed.png     2025 filed
//   home-before-after.png  the old Home next to the new one (only if
//                          before-source.png, a 393x793pt screenshot of the
//                          old Home in the in-progress state, is in this
//                          folder)
//
// It needs a LOCAL/TEST backend with made-up data, never a real customer's
// account: the Return Review demo account (see ../review-screen/README.md),
// and DEMO_DATABASE_URL pointing at that database so each state can be set
// with seed-home-states.sql (via psql). Build the web app against that
// backend first, or pass --rebuild with DEMO_SUPABASE_URL and
// DEMO_SUPABASE_ANON_KEY set.
//
// Needs: Node 18+, Playwright (npm i -D playwright; npx playwright install
// chromium) and psql on the PATH.
//
// Run from the project root:  node marketing/home-screen/make-home-screen.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { APP_SCALE, APP_VIEWPORT, renderBrandedImage } from '../shared/brand-frame.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// ─── Tweak here ───────────────────────────────────────────────────────────────
const STATES = [
  { name: 'in-progress', seed: 'in_progress', waitFor: 'Add your deductions' },
  { name: 'not-started', seed: 'not_started', waitFor: 'Start your 2025 return' },
  { name: 'completed', seed: 'completed', waitFor: 'You’re done for 2025' },
];
// A morning 49 days before the 2025 deadline, so the pill reads "49 days left".
const APP_TIME = '2026-02-10T09:00:00+01:00';

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoPass-2026'; // a throwaway local account
const DATABASE_URL = process.env.DEMO_DATABASE_URL;

const FORMAT = { width: 1080, height: 1350 };
// Any BRAND_DEFAULTS key from ../shared/brand-frame.mjs.
const BRAND_OPTIONS = {};
// ──────────────────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dist = path.join(root, 'dist');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fileo-home-screen-'));
const log = (...args) => console.log('[home-screen]', ...args);

// ─── Web build + a tiny static server ────────────────────────────────────────
function ensureBuild() {
  if (process.argv.includes('--rebuild') || !fs.existsSync(path.join(dist, 'index.html'))) {
    if (!process.env.DEMO_SUPABASE_URL || !process.env.DEMO_SUPABASE_ANON_KEY) {
      throw new Error('To build, set DEMO_SUPABASE_URL and DEMO_SUPABASE_ANON_KEY (a local/test backend), or build dist/ yourself.');
    }
    log('building the web app into dist/ …');
    const r = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', 'dist'], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: process.env.DEMO_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.DEMO_SUPABASE_ANON_KEY },
    });
    if (r.status !== 0) throw new Error('web build failed');
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function startServer() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file;
    if (url.startsWith('/__work/')) {
      file = path.join(work, url.slice('/__work/'.length));
    } else if (url.startsWith('/__here/')) {
      file = path.join(here, url.slice('/__here/'.length));
    } else {
      const candidates = [url, `${url}.html`, path.join(url, 'index.html')].map((p) => path.join(dist, p));
      file = candidates.find((p) => p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile()) ?? path.join(dist, 'index.html');
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ─── Demo data ───────────────────────────────────────────────────────────────
function seed(state) {
  execFileSync('psql', [DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-o', os.devNull, '-v', `state=${state}`, '-f', path.join(here, 'seed-home-states.sql')], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
}

// ─── Screenshots ─────────────────────────────────────────────────────────────
const splashGone = (page) => page.waitForFunction(() => !document.querySelector('[aria-label="Fileo"]'), null, { timeout: 30000 });

async function captureStates(browser, base) {
  const context = await browser.newContext({ viewport: APP_VIEWPORT, deviceScaleFactor: APP_SCALE, timezoneId: 'Africa/Lagos', reducedMotion: 'no-preference' });
  await context.clock.install({ time: new Date(APP_TIME) }); // ticks normally from there
  const page = await context.newPage();
  seed(STATES[0].seed); // before signing in, so the profile loads with the demo name
  await page.goto(`${base}/sign-in`, { waitUntil: 'load' });
  await splashGone(page);
  await page.getByPlaceholder('you@example.com').fill(DEMO_EMAIL);
  await page.getByPlaceholder('Enter your password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 30000 });

  const shots = {};
  for (const state of STATES) {
    seed(state.seed);
    await page.goto(`${base}/home`, { waitUntil: 'load' });
    await splashGone(page);
    await page.getByText(state.waitFor, { exact: true }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500); // let data and fonts settle
    shots[state.name] = path.join(work, `${state.name}.png`);
    await page.screenshot({ path: shots[state.name] });
  }
  await context.close();
  return shots;
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!DATABASE_URL) {
    throw new Error('Set DEMO_DATABASE_URL to the LOCAL/TEST database (psql connection string) so each state can be seeded.');
  }
  ensureBuild();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const shots = await captureStates(browser, base);
    for (const state of STATES) {
      await renderBrandedImage(browser, {
        ...FORMAT,
        phones: [{ image: shots[state.name] }],
        out: path.join(here, `home-${state.name}.png`),
        options: BRAND_OPTIONS,
      });
      log(`wrote home-${state.name}.png`);
    }
    if (fs.existsSync(path.join(here, 'before-source.png'))) {
      await renderBrandedImage(browser, {
        ...FORMAT,
        phones: [
          { image: path.join(here, 'before-source.png'), caption: 'Before' },
          { image: shots['in-progress'], caption: 'After' },
        ],
        out: path.join(here, 'home-before-after.png'),
        options: { ...BRAND_OPTIONS, phoneHeightRatio: 0.66 },
      });
      log('wrote home-before-after.png');
    }
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
