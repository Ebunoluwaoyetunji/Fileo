// Renders the Home screen for social posts: the real, signed-in web build in
// three states, each composited into the same clean phone frame as the
// Return Review and splash exports.
//
// Outputs (in this folder), all 1080x1350:
//   home-in-progress.png   3 of 5 steps done, estimated tax, past years
//   home-not-started.png   nothing filed yet
//   home-completed.png     2025 filed
//   home-before-after.png  the old Home next to the new one (only if
//                          before-source.png, a 390x797 screenshot of the
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

const FORMAT = { width: 1080, height: 1350, phoneHeight: 1150 };
const COLORS = { backgroundTop: '#F4F5F2', backgroundBottom: '#E4E9E7', phone: '#121821', label: '#0B1628' };
// The phone is 390x844; the web build has no status bar, so the app is
// captured below a painted one (the hero's tint, with the time and icons).
const PHONE = { width: 390, height: 844 };
const STATUS_BAR = { height: 47, background: '#ECF2EE', color: '#111417' };
const APP_VIEWPORT = { width: PHONE.width, height: PHONE.height - STATUS_BAR.height };
const APP_SCALE = 3;
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
  const context = await browser.newContext({ viewport: APP_VIEWPORT, deviceScaleFactor: APP_SCALE, reducedMotion: 'no-preference' });
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
    await page.waitForTimeout(1500); // the ring's fill sweeps in
    shots[state.name] = path.join(work, `${state.name}.png`);
    await page.screenshot({ path: shots[state.name] });
  }
  await context.close();
  return shots;
}

// ─── Phone frame ─────────────────────────────────────────────────────────────
function phoneCss(phoneHeight) {
  const b = Math.round(phoneHeight * 0.0125);
  const screenH = phoneHeight - 2 * b;
  const screenW = Math.round((screenH * PHONE.width) / PHONE.height);
  const radius = Math.round(phoneHeight * 0.075);
  const k = screenW / PHONE.width; // app points -> frame pixels
  const barH = Math.round(STATUS_BAR.height * k);
  return `
  .phone{position:relative;flex:none;width:${screenW + 2 * b}px;height:${phoneHeight}px;border-radius:${radius}px;background:${COLORS.phone};
       box-shadow:0 ${Math.round(phoneHeight * 0.04)}px ${Math.round(phoneHeight * 0.08)}px rgba(11,22,40,0.20),0 6px 18px rgba(11,22,40,0.12),inset 0 0 0 1.5px rgba(255,255,255,0.10)}
  .screen{position:absolute;left:${b}px;top:${b}px;width:${screenW}px;height:${screenH}px;border-radius:${radius - b}px;overflow:hidden;background:#fff}
  .status{position:absolute;left:0;top:0;right:0;height:${barH}px;background:${STATUS_BAR.background};color:${STATUS_BAR.color};
       display:flex;align-items:center;justify-content:space-between;padding:${Math.round(4 * k)}px ${Math.round(30 * k)}px 0 ${Math.round(36 * k)}px;box-sizing:border-box}
  .time{font-size:${Math.round(16 * k)}px;font-weight:600;letter-spacing:0.2px}
  .icons{display:flex;align-items:center;gap:${Math.round(6 * k)}px;font-size:${Math.round(15 * k)}px}
  .icons svg{display:block}
  .screen img{position:absolute;left:0;top:${barH}px;width:100%;height:${screenH - barH}px}
  .camera{position:absolute;left:50%;top:${Math.round(b + screenH * 0.018)}px;width:${Math.round(screenW * 0.035)}px;height:${Math.round(screenW * 0.035)}px;margin-left:-${Math.round(screenW * 0.0175)}px;border-radius:50%;background:#05080D;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.06)}`;
}

// Signal, wifi and battery, drawn at app-point size and scaled with the frame.
const STATUS_ICONS = `<div class="icons">
  <svg width="1.1em" height="0.72em" viewBox="0 0 18 12"><g fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
  <svg width="1em" height="0.72em" viewBox="0 0 16 12"><path fill="currentColor" d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.9 10.9 0 0 0 8 .4 10.9 10.9 0 0 0 .5 3.4l1.2 1.3A9.1 9.1 0 0 1 8 2.2Zm0 3.5c1.5 0 2.9.6 3.9 1.5l1.2-1.3A7.4 7.4 0 0 0 8 3.9a7.4 7.4 0 0 0-5.1 2l1.2 1.3c1-.9 2.4-1.5 3.9-1.5Zm0 3.4c.6 0 1.2.2 1.6.6L8 11.6 6.4 9.7c.4-.4 1-.6 1.6-.6Z"/></svg>
  <svg width="1.6em" height="0.8em" viewBox="0 0 26 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-opacity="0.4"/><rect x="2" y="2" width="19" height="9" rx="2.2" fill="currentColor"/><path d="M24 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" fill-opacity="0.45"/></svg>
</div>`;

const page = (body, css) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${FORMAT.width}px;height:${FORMAT.height}px;overflow:hidden}
  body{background:radial-gradient(ellipse 60% 55% at 50% 48%, rgba(11,110,79,0.07), rgba(11,110,79,0) 70%),
       linear-gradient(170deg, ${COLORS.backgroundTop} 0%, ${COLORS.backgroundBottom} 100%);
       display:flex;align-items:center;justify-content:center;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
  ${css}
  </style></head><body>${body}</body></html>`;

const phone = (id) =>
  `<div class="phone"><div class="screen"><div class="status"><span class="time">9:41</span>${STATUS_ICONS}</div><img id="${id}"></div><div class="camera"></div></div>`;

function singleHtml() {
  return page(phone('a'), phoneCss(FORMAT.phoneHeight));
}

function beforeAfterHtml() {
  const phoneHeight = 1020;
  return page(
    `<div class="pair">
       <div class="col"><div class="label">Before</div>${phone('before')}</div>
       <div class="col"><div class="label">After</div>${phone('after')}</div>
     </div>`,
    `${phoneCss(phoneHeight)}
    .pair{display:flex;gap:56px;align-items:flex-start}
    .col{display:flex;flex-direction:column;align-items:center;gap:28px}
    .label{font-size:30px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:${COLORS.label}}`
  );
}

async function render(browser, base, html, images, out) {
  fs.writeFileSync(path.join(work, 'frame.html'), html);
  const tab = await browser.newPage({ viewport: { width: FORMAT.width, height: FORMAT.height }, deviceScaleFactor: 1 });
  await tab.goto(`${base}/__work/frame.html`);
  await tab.evaluate(async (sources) => {
    await Promise.all(Object.entries(sources).map(async ([id, src]) => {
      const img = document.getElementById(id);
      img.setAttribute('src', src);
      await img.decode();
    }));
  }, images);
  await tab.screenshot({ path: out });
  await tab.close();
}

const workUrl = (base, file) => `${base}/__work/${path.relative(work, file).split(path.sep).join('/')}`;

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
      await render(browser, base, singleHtml(), { a: workUrl(base, shots[state.name]) }, path.join(here, `home-${state.name}.png`));
      log(`wrote home-${state.name}.png`);
    }
    if (fs.existsSync(path.join(here, 'before-source.png'))) {
      await render(
        browser,
        base,
        beforeAfterHtml(),
        { before: `${base}/__here/before-source.png`, after: workUrl(base, shots['in-progress']) },
        path.join(here, 'home-before-after.png')
      );
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
