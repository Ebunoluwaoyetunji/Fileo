// Renders the "Review your tax return" demo videos for social posts (no screen
// recording): the real, signed-in web build is driven frame by frame with
// Playwright's clock (taps, a smooth scroll), each frame is composited into
// a phone frame, and ffmpeg assembles them at 60fps.
//
// Outputs (in this folder):
//   fileo-review-4x5.mp4   1080x1350, H.264 / yuv420p, 60fps (LinkedIn feed)
//   fileo-review-1x1.mp4   1080x1080, same encoding
//   fileo-review.gif       720px wide (4:5), 30fps
//   fileo-review-still.png the final frame ("ready to submit" sheet)
//
// Story: the review screen → tap Income Summary (opens) → tap Tax calculation
// (opens) → smooth scroll through the breakdown to the bottom → tap "Approve
// and submit" → the "ready to submit" sheet. It stops there: nothing is
// actually submitted.
//
// It needs a signed-in account with a COMPLETE draft return (nothing missing),
// on a backend the web build points at. Use a local/test backend with made-up
// data, never a real customer's account. This script is set up for the local
// stack in the README: the web app is built with
//   EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY  (or DEMO_SUPABASE_URL
//   / DEMO_SUPABASE_ANON_KEY when the script builds it for you: pass --rebuild)
// and the account is DEMO_EMAIL / DEMO_PASSWORD.
//
// Needs: Node 18+, Playwright (npm i -D playwright; npx playwright install
// chromium) and ffmpeg on the PATH (or FFMPEG=/path/to/ffmpeg).
//
// Run from the project root:  node marketing/review-demo/make-review-demo.mjs
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
const FPS = 60;
// The story, in seconds from the first frame.
const FIRST_TAP_S = 1.0; // hold on the screen, then open Income Summary
const SECOND_TAP_S = 2.5; // open Tax calculation
const SCROLL_START_S = 3.3;
const SCROLL_DURATION_S = 3.8; // ease-in-out, top to bottom
const APPROVE_TAP_S = 7.6; // tap "Approve and submit"
const END_S = 10.2; // hold on the sheet
const TAP_MS = 380; // the tap marker's life
const GIF_WIDTH = 720;
const GIF_FPS = 30;

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoPass-2026'; // a throwaway local account

const COLORS = {
  navy: '#0B1628',
  backgroundTop: '#F4F5F2',
  backgroundBottom: '#E4E9E7',
  phone: '#121821',
};

const FORMATS = [
  { name: '4x5', width: 1080, height: 1350, phoneHeight: 1150 },
  { name: '1x1', width: 1080, height: 1080, phoneHeight: 930 },
];
const APP_VIEWPORT = { width: 390, height: 844 };
const APP_SCALE = 3;
// ──────────────────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dist = path.join(root, 'dist');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fileo-review-demo-'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const frameMs = 1000 / FPS;

function log(...args) {
  console.log('[review-demo]', ...args);
}

// ─── 1. Web build + a tiny static server ─────────────────────────────────────
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

// ─── 2. Drive the screen and capture every frame ─────────────────────────────
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const splashGone = (page) => page.waitForFunction(() => !document.querySelector('[aria-label="Fileo"]'), null, { timeout: 30000 });

async function captureRun(browser, base) {
  const dir = path.join(work, 'frames');
  fs.mkdirSync(dir);
  const context = await browser.newContext({ viewport: APP_VIEWPORT, deviceScaleFactor: APP_SCALE, reducedMotion: 'no-preference' });
  await context.clock.install({ time: new Date('2026-01-05T09:00:00Z') }); // ticks normally until we pause it
  const page = await context.newPage();

  // Sign in for real, then open the review screen.
  await page.goto(`${base}/sign-in`, { waitUntil: 'load' });
  await splashGone(page);
  await page.getByPlaceholder('you@example.com').fill(DEMO_EMAIL);
  await page.getByPlaceholder('Enter your password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 30000 });
  await page.goto(`${base}/return-review`, { waitUntil: 'load' });
  await splashGone(page);
  await page.getByTestId('income-summary-toggle').waitFor({ timeout: 30000 });
  // "Checking your return…" gone and the button enabled: nothing missing.
  await page.getByText('Checking your return').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  const approve = page.getByRole('button', { name: 'Approve and submit' });
  await approve.waitFor({ timeout: 30000 });
  if (await approve.isDisabled()) throw new Error('"Approve and submit" is disabled: the demo return has something missing.');
  await page.waitForTimeout(600);

  // From here on, time only moves when we say so.
  const now = await page.evaluate(() => Date.now());
  await context.clock.pauseAt(new Date(now + 50));

  // The scrolling area, and a tap marker drawn inside the page.
  await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4;
    });
    scrollers.sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight));
    window.__scroller = scrollers[0] ?? null;
    const dot = document.createElement('div');
    dot.id = '__tap';
    dot.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(11,22,40,0.16);border:1.5px solid rgba(11,22,40,0.22);pointer-events:none;opacity:0;z-index:99999';
    document.body.appendChild(dot);
  });
  const centre = (locator) =>
    locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

  let tap = null; // { x, y, startMs }
  const taps = [
    { at: FIRST_TAP_S, locator: () => page.getByTestId('income-summary-toggle') },
    { at: SECOND_TAP_S, locator: () => page.getByTestId('tax-calculation-toggle') },
    { at: APPROVE_TAP_S, locator: () => approve },
  ];
  let scrollMax = 0;
  const frames = [];
  const total = Math.round(END_S * FPS);
  let appMs = 0;
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    // Taps: aim at the element where it is right now, then really click.
    for (const tp of taps) {
      if (!tp.done && t >= tp.at) {
        tp.done = true;
        const c = await centre(tp.locator());
        tap = { ...c, startMs: i * frameMs };
        await page.mouse.click(c.x, c.y);
      }
    }
    // Smooth scroll (set every frame, from the eased progress).
    if (t >= SCROLL_START_S) {
      const p = Math.min(1, (t - SCROLL_START_S) / SCROLL_DURATION_S);
      scrollMax = await page.evaluate(([progress]) => {
        const el = window.__scroller;
        if (!el) return 0;
        const max = el.scrollHeight - el.clientHeight;
        el.scrollTop = max * progress;
        return max;
      }, [easeInOut(p)]);
    }
    // The tap marker: grows a little and fades.
    const age = tap ? i * frameMs - tap.startMs : Infinity;
    await page.evaluate(([x, y, a, life]) => {
      const dot = document.getElementById('__tap');
      const k = a >= life ? 1 : a / life;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.opacity = a >= life ? '0' : String(0.9 * (1 - k * k));
      dot.style.transform = `scale(${0.7 + 0.55 * (1 - Math.pow(1 - k, 2))})`;
    }, [tap?.x ?? 0, tap?.y ?? 0, age, TAP_MS]);

    const file = path.join(dir, `${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push(file);
    const target = Math.round((i + 1) * frameMs);
    await context.clock.runFor(target - appMs);
    appMs = target;
  }
  await context.close();
  log(`captured ${frames.length} frames (scrolled ${Math.round(scrollMax)}px)`);
  return frames;
}

// ─── 3. Composite into the phone frame ───────────────────────────────────────
function bezel(format) {
  return Math.round(format.phoneHeight * 0.0125);
}

function demoHtml(format) {
  const b = bezel(format);
  const screenH = format.phoneHeight - 2 * b;
  const screenW = Math.round((screenH * APP_VIEWPORT.width) / APP_VIEWPORT.height);
  const phoneW = screenW + 2 * b;
  const radius = Math.round(format.phoneHeight * 0.075);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${format.width}px;height:${format.height}px;overflow:hidden}
  body{background:radial-gradient(ellipse 60% 55% at 50% 48%, rgba(11,110,79,0.07), rgba(11,110,79,0) 70%),
       linear-gradient(170deg, ${COLORS.backgroundTop} 0%, ${COLORS.backgroundBottom} 100%);
       display:flex;align-items:center;justify-content:center}
  .phone{position:relative;width:${phoneW}px;height:${format.phoneHeight}px;border-radius:${radius}px;background:${COLORS.phone};
       box-shadow:0 ${Math.round(format.phoneHeight * 0.04)}px ${Math.round(format.phoneHeight * 0.08)}px rgba(11,22,40,0.20),0 6px 18px rgba(11,22,40,0.12),inset 0 0 0 1.5px rgba(255,255,255,0.10)}
  .screen{position:absolute;left:${b}px;top:${b}px;width:${screenW}px;height:${screenH}px;border-radius:${radius - b}px;overflow:hidden;background:#fff}
  .screen img{position:absolute;inset:0;width:100%;height:100%}
  .camera{position:absolute;left:50%;top:${Math.round(b + screenH * 0.018)}px;width:${Math.round(screenW * 0.035)}px;height:${Math.round(screenW * 0.035)}px;margin-left:-${Math.round(screenW * 0.0175)}px;border-radius:50%;background:#05080D;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.06)}
  </style></head><body>
  <div class="phone"><div class="screen"><img id="a"></div><div class="camera"></div></div>
  </body></html>`;
}

async function renderFormat(browser, base, format, frames) {
  const dir = path.join(work, `out-${format.name}`);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(work, `demo-${format.name}.html`), demoHtml(format));
  const page = await browser.newPage({ viewport: { width: format.width, height: format.height }, deviceScaleFactor: 1 });
  await page.goto(`${base}/__work/demo-${format.name}.html`);
  for (let i = 0; i < frames.length; i++) {
    const url = `${base}/__work/${path.relative(work, frames[i]).split(path.sep).join('/')}`;
    await page.evaluate(async (u) => {
      const img = document.getElementById('a');
      img.setAttribute('src', u);
      await img.decode();
    }, url);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(4, '0')}.png`) });
  }
  await page.close();
  return dir;
}

// ─── 4. Encode ───────────────────────────────────────────────────────────────
function encodeMp4(framesDir, output) {
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(framesDir, '%04d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    '-r', String(FPS), '-movflags', '+faststart',
    output,
  ]);
}

function encodeGif(framesDir, output) {
  const palette = path.join(work, 'palette.png');
  const filters = `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`;
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%04d.png'),
    '-vf', `${filters},palettegen=max_colors=192:stats_mode=diff`, palette]);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%04d.png'), '-i', palette,
    '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', output]);
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  ensureBuild();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    log('capturing the review screen …');
    const frames = await captureRun(browser, base);
    log(`timeline: ${frames.length} frames = ${(frames.length / FPS).toFixed(2)}s at ${FPS}fps`);
    for (const format of FORMATS) {
      log(`compositing ${format.width}x${format.height} …`);
      const dir = await renderFormat(browser, base, format, frames);
      const mp4 = path.join(here, `fileo-review-${format.name}.mp4`);
      encodeMp4(dir, mp4);
      log(`wrote ${path.relative(root, mp4)}`);
      if (format.name === '4x5') {
        const gif = path.join(here, 'fileo-review.gif');
        encodeGif(dir, gif);
        log(`wrote ${path.relative(root, gif)}`);
        fs.copyFileSync(path.join(dir, `${String(frames.length - 1).padStart(4, '0')}.png`), path.join(here, 'fileo-review-still.png'));
      }
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
