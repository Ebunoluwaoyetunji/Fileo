// Renders the three onboarding screens, exactly as they look in the app, as
// LinkedIn stills in the calm branded frame (../shared/brand-frame.mjs):
//
//   onboarding-1.png, -2.png, -3.png   1080x1350 (4:5), one phone each, for a carousel
//   onboarding-all.png                 1920x1080, all three side by side
//
// The screens are signed-out, so no account or data is needed; the web build
// just needs to start (any Supabase URL works). Each screen is captured fully
// settled: its auto-advance timer is switched off in the browser (the app
// isn't changed), and the capture waits for the illustration and the page
// indicator to finish animating in.
//
// Needs: Node 18+ and Playwright (npm i -D playwright; npx playwright install
// chromium). Build the web app first (npx expo export --platform web
// --output-dir dist), or pass --rebuild.
//
// Run from the project root:  node marketing/onboarding/make-stills.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { APP_VIEWPORT, renderBrandedImage } from '../shared/brand-frame.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// ─── Tweak here ───────────────────────────────────────────────────────────────
// Captions: each screen's own headline, shortened.
const STEPS = [
  { route: '/step-1', heading: 'File Your Taxes Without the Stress', caption: 'File your taxes without the stress' },
  { route: '/step-2', heading: 'File in Five Simple Steps', caption: 'File in five simple steps' },
  { route: '/step-3', heading: 'Your Data Is Safe', caption: 'Your data is safe' },
];
const SINGLE = { width: 1080, height: 1350 };
const ALL = { width: 1920, height: 1080 };
// Any BRAND_DEFAULTS key from ../shared/brand-frame.mjs, e.g. monogramCorner.
const BRAND_OPTIONS = {};
const APP_SCALE = 3;
const AUTO_ADVANCE_MS = 4500; // constants/theme.ts onboardingLayout.autoAdvanceMs
const SETTLE_MS = 2000;
// ──────────────────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dist = path.join(root, 'dist');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fileo-onboarding-'));
const log = (...args) => console.log('[onboarding]', ...args);

function ensureBuild() {
  if (process.argv.includes('--rebuild') || !fs.existsSync(path.join(dist, 'index.html'))) {
    log('building the web app into dist/ …');
    const r = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', 'dist'], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (r.status !== 0) throw new Error('web build failed');
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function startServer() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const candidates = [url, `${url}.html`, path.join(url, 'index.html')].map((p) => path.join(dist, p));
    const file = candidates.find((p) => p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile()) ?? path.join(dist, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const splashGone = (page) => page.waitForFunction(() => !document.querySelector('[aria-label="Fileo"]'), null, { timeout: 30000 });

async function captureStep(browser, base, step) {
  const context = await browser.newContext({ viewport: APP_VIEWPORT, deviceScaleFactor: APP_SCALE, reducedMotion: 'no-preference' });
  // Keep each screen in place: drop the carousel's auto-advance timer only.
  await context.addInitScript((ms) => {
    const original = window.setTimeout;
    window.setTimeout = (fn, delay, ...args) => (delay === ms ? 0 : original(fn, delay, ...args));
  }, AUTO_ADVANCE_MS);
  const page = await context.newPage();
  await page.goto(`${base}${step.route}`, { waitUntil: 'load' });
  await splashGone(page);
  await page.getByText(step.heading, { exact: true }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(SETTLE_MS);
  if (!page.url().endsWith(step.route)) {
    throw new Error(`expected ${step.route}, but the app is on ${page.url()}`);
  }
  const file = path.join(work, `${path.basename(step.route)}.png`);
  await page.screenshot({ path: file });
  await context.close();
  return file;
}

async function main() {
  ensureBuild();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const shots = [];
    for (const step of STEPS) {
      shots.push(await captureStep(browser, base, step));
      log(`captured ${step.route}`);
    }
    for (let i = 0; i < STEPS.length; i++) {
      const out = path.join(here, `onboarding-${i + 1}.png`);
      await renderBrandedImage(browser, {
        ...SINGLE,
        phones: [{ image: shots[i], caption: STEPS[i].caption }],
        out,
        options: BRAND_OPTIONS,
      });
      log(`wrote ${path.basename(out)}`);
    }
    await renderBrandedImage(browser, {
      ...ALL,
      phones: STEPS.map((step, i) => ({ image: shots[i], caption: step.caption })),
      out: path.join(here, 'onboarding-all.png'),
      options: BRAND_OPTIONS,
    });
    log('wrote onboarding-all.png');
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
