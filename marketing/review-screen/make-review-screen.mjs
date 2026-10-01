// Renders the Return Review screen for social posts (no screen recording):
// the real, signed-in web build is driven frame by frame with Playwright's
// clock, each frame goes into the shared phone frame on the calm brand
// background (../shared/brand-frame.mjs), and ffmpeg assembles the video at
// 60fps.
//
// Outputs (in this folder), all 1080x1350:
//   review-summary.png      Summary tab
//   review-calculation.png  Calculation tab (the timeline)
//   review-tax-bands.png    the "How tax bands work" sheet
//   review-documents.png    Documents tab
//   review-before-after.png the old screen next to the new Summary tab (if
//                           before-source.png is here)
//   review-tabs.mp4         H.264 / yuv420p, 60fps: Summary → Calculation
//                           (scrolls through the working) → Documents → Summary
//
// It needs a signed-in account with a COMPLETE draft return on a LOCAL/TEST
// backend with made-up data (see README.md and seed-demo-return.sql), never
// a real customer's account. The account is DEMO_EMAIL / DEMO_PASSWORD.
// Build the web app against that backend first, or pass --rebuild with
// DEMO_SUPABASE_URL and DEMO_SUPABASE_ANON_KEY set.
//
// Needs: Node 18+, Playwright (npm i -D playwright; npx playwright install
// chromium) and ffmpeg on the PATH (or FFMPEG=/path/to/ffmpeg).
//
// Run from the project root:  node marketing/review-screen/make-review-screen.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { APP_SCALE, APP_VIEWPORT, brandedFrameHtml, paintStatusBars, renderBrandedImage } from '../shared/brand-frame.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// ─── Tweak here ───────────────────────────────────────────────────────────────
const FPS = 60;
const TAP_MS = 380; // life of the tap marker
// The video, as steps: hold, tap a tab, or scroll (seconds).
const SCRIPT = [
  { hold: 1.4 },
  { tap: 'Calculation' },
  { hold: 0.9 },
  { scrollTo: 'tabs', over: 1.1 }, // bring the tabs to the top
  { scrollTo: 'end', over: 2.2 }, // down through the working
  { hold: 1.0 },
  { scrollTo: 'top', over: 1.2 },
  { hold: 0.3 },
  { tap: 'Documents' },
  { hold: 1.8 },
  { tap: 'Summary' },
  { hold: 1.4 },
];

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoPass-2026'; // a throwaway local account

const FORMAT = { width: 1080, height: 1350 };
// Any BRAND_DEFAULTS key from ../shared/brand-frame.mjs.
const BRAND_OPTIONS = {};
// ──────────────────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dist = path.join(root, 'dist');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fileo-review-screen-'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const frameMs = 1000 / FPS;
const log = (...args) => console.log('[review-screen]', ...args);

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

// ─── Open the screen, signed in, with time under our control ─────────────────
const splashGone = (page) => page.waitForFunction(() => !document.querySelector('[aria-label="Fileo"]'), null, { timeout: 30000 });

async function openReview(browser, base) {
  const context = await browser.newContext({ viewport: APP_VIEWPORT, deviceScaleFactor: APP_SCALE, reducedMotion: 'no-preference' });
  await context.clock.install({ time: new Date('2026-01-05T09:00:00Z') }); // ticks normally until paused
  const page = await context.newPage();
  await page.goto(`${base}/sign-in`, { waitUntil: 'load' });
  await splashGone(page);
  await page.getByPlaceholder('you@example.com').fill(DEMO_EMAIL);
  await page.getByPlaceholder('Enter your password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 30000 });
  await page.goto(`${base}/return-review`, { waitUntil: 'load' });
  await splashGone(page);
  await page.getByRole('tab', { name: 'Summary' }).waitFor({ timeout: 30000 });
  await page.getByText('Check everything before you submit').waitFor({ timeout: 30000 });
  // Let the documents list load once, so the Documents tab is instant.
  await page.getByRole('tab', { name: 'Documents' }).click();
  await page.getByText('.pdf').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.getByRole('tab', { name: 'Calculation' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('tab', { name: 'Summary' }).click();
  await page.waitForTimeout(800);
  const now = await page.evaluate(() => Date.now());
  await context.clock.pauseAt(new Date(now + 50));

  await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4;
    });
    scrollers.sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight));
    window.__scroller = scrollers[0] ?? null;
    const dot = document.createElement('div');
    dot.id = '__tap';
    dot.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(11,22,40,0.14);border:1.5px solid rgba(11,22,40,0.2);pointer-events:none;opacity:0;z-index:99999';
    document.body.appendChild(dot);
  });
  return { context, page };
}

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

async function scrollTop(page) {
  return page.evaluate(() => window.__scroller?.scrollTop ?? 0);
}
async function scrollTargets(page) {
  return page.evaluate(() => {
    const el = window.__scroller;
    if (!el) return { top: 0, tabs: 0, end: 0 };
    const tablist = document.querySelector('[role="tablist"]');
    const header = el.getBoundingClientRect().top;
    const tabs = tablist ? el.scrollTop + tablist.getBoundingClientRect().top - header - 16 : 0;
    return { top: 0, tabs: Math.max(0, tabs), end: el.scrollHeight - el.clientHeight };
  });
}
const setScroll = (page, y) => page.evaluate((v) => { if (window.__scroller) window.__scroller.scrollTop = v; }, y);
const setTap = (page, x, y, age) =>
  page.evaluate(([px, py, a, life]) => {
    const dot = document.getElementById('__tap');
    const k = a >= life ? 1 : a / life;
    dot.style.left = `${px}px`;
    dot.style.top = `${py}px`;
    dot.style.opacity = a >= life ? '0' : String(0.9 * (1 - k * k));
    dot.style.transform = `scale(${0.7 + 0.55 * (1 - Math.pow(1 - k, 2))})`;
  }, [x, y, age, TAP_MS]);

// ─── Stills ──────────────────────────────────────────────────────────────────
async function captureStills(browser, base) {
  const { context, page } = await openReview(browser, base);
  const shots = {};
  const settle = async () => { await context.clock.runFor(600); };
  shots.summary = path.join(work, 'still-summary.png');
  await page.screenshot({ path: shots.summary });
  await page.getByRole('tab', { name: 'Calculation' }).click();
  await settle();
  await setScroll(page, (await scrollTargets(page)).tabs);
  await settle();
  shots.calculation = path.join(work, 'still-calculation.png');
  await page.screenshot({ path: shots.calculation });
  await page.getByRole('button', { name: 'How tax bands work', exact: true }).click();
  // The sheet slides in with a CSS animation, which runs in real time.
  await page.waitForTimeout(900);
  await settle();
  shots['tax-bands'] = path.join(work, 'still-tax-bands.png');
  await page.screenshot({ path: shots['tax-bands'] });
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.waitForTimeout(900);
  await settle();
  await setScroll(page, 0);
  await page.getByRole('tab', { name: 'Documents' }).click();
  await settle();
  shots.documents = path.join(work, 'still-documents.png');
  await page.screenshot({ path: shots.documents });
  await context.close();
  return shots;
}

// ─── Video frames ────────────────────────────────────────────────────────────
async function captureVideo(browser, base) {
  const dir = path.join(work, 'frames');
  fs.mkdirSync(dir);
  const { context, page } = await openReview(browser, base);
  const frames = [];
  let tap = null;
  let frame = 0;
  let appMs = 0;
  const shoot = async () => {
    await setTap(page, tap?.x ?? 0, tap?.y ?? 0, tap ? frame * frameMs - tap.startMs : Infinity);
    const file = path.join(dir, `${String(frame).padStart(4, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push(file);
    frame += 1;
    const target = Math.round(frame * frameMs);
    await context.clock.runFor(target - appMs);
    appMs = target;
  };
  for (const step of SCRIPT) {
    if (step.hold) {
      for (let i = 0; i < Math.round(step.hold * FPS); i++) await shoot();
    } else if (step.tap) {
      const tab = page.getByRole('tab', { name: step.tap });
      const box = await tab.boundingBox();
      tap = { x: box.x + box.width / 2, y: box.y + box.height / 2, startMs: frame * frameMs };
      await page.mouse.click(tap.x, tap.y);
      await shoot();
    } else if (step.scrollTo) {
      const from = await scrollTop(page);
      const to = (await scrollTargets(page))[step.scrollTo];
      const n = Math.round(step.over * FPS);
      for (let i = 1; i <= n; i++) {
        await setScroll(page, from + (to - from) * easeInOut(i / n));
        await shoot();
      }
    }
  }
  await context.close();
  log(`captured ${frames.length} frames (${(frames.length / FPS).toFixed(2)}s)`);
  return frames;
}

// ─── Phone frame ─────────────────────────────────────────────────────────────
/** Puts each app frame into the shared phone frame (../shared/brand-frame.mjs). */
async function composite(browser, base, inputs, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(work, 'phone.html'), brandedFrameHtml({ ...FORMAT, phones: [{ src: '' }], options: BRAND_OPTIONS }));
  const page = await browser.newPage({ viewport: { width: FORMAT.width, height: FORMAT.height }, deviceScaleFactor: 1 });
  await page.goto(`${base}/__work/phone.html`);
  await page.evaluate(() => document.fonts.ready);
  const outputs = [];
  for (let i = 0; i < inputs.length; i++) {
    const url = `${base}/__work/${path.relative(work, inputs[i]).split(path.sep).join('/')}`;
    await page.evaluate((u) => {
      document.getElementById('img0').setAttribute('src', u);
    }, url);
    await paintStatusBars(page, 1);
    const out = path.join(outDir, `${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: out });
    outputs.push(out);
  }
  await page.close();
  return outputs;
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  ensureBuild();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    log('stills …');
    const shots = await captureStills(browser, base);
    const names = ['summary', 'calculation', 'tax-bands', 'documents'];
    const framed = await composite(browser, base, names.map((n) => shots[n]), path.join(work, 'stills'));
    names.forEach((n, i) => fs.copyFileSync(framed[i], path.join(here, `review-${n}.png`)));
    log(`wrote ${names.map((n) => `review-${n}.png`).join(', ')}`);
    // The old Return Review next to the new one (before-source.png: the old
    // screen at the same size, captured from the commit before the redesign).
    if (fs.existsSync(path.join(here, 'before-source.png'))) {
      await renderBrandedImage(browser, {
        ...FORMAT,
        phones: [
          { image: path.join(here, 'before-source.png'), caption: 'Before' },
          { image: shots.summary, caption: 'After' },
        ],
        out: path.join(here, 'review-before-after.png'),
        options: { ...BRAND_OPTIONS, phoneHeightRatio: 0.66 },
      });
      log('wrote review-before-after.png');
    }

    log('video frames …');
    const frames = await captureVideo(browser, base);
    const dir = path.join(work, 'video');
    await composite(browser, base, frames, dir);
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-framerate', String(FPS), '-i', path.join(dir, '%04d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
      '-r', String(FPS), '-movflags', '+faststart',
      path.join(here, 'review-tabs.mp4'),
    ]);
    log('wrote review-tabs.mp4');
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
