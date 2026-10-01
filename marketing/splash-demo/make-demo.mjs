// Renders the animated-splash demo videos for social posts (no screen
// recording): the web build is driven frame by frame with Playwright's clock,
// each frame goes into the shared phone frame on the calm brand background
// (../shared/brand-frame.mjs), and ffmpeg assembles them at 60fps.
//
// Outputs (in this folder):
//   fileo-splash-4x5.mp4   1080x1350, H.264 / yuv420p, 60fps (LinkedIn feed)
//   fileo-splash-1x1.mp4   1080x1080, same encoding
//   fileo-splash.gif       720px wide (4:5), 30fps
//   fileo-splash-still.png a frame from the middle of the zoom through the O
//
// Sequence: plain navy (as the native splash) → the splash at real speed
// (ball bouncing across FILEO, zoom through the O) → the next screen
// (signed-out onboarding) → crossfade to navy → the splash again at 0.5x
// with a "0.5x" label → hold on the next screen.
//
// Needs: Node 18+, Playwright (npm i -D playwright; npx playwright install
// chromium) and ffmpeg on the PATH (or FFMPEG=/path/to/ffmpeg). Builds the
// web app into dist/ if it isn't there (or pass --rebuild).
//
// Run from the project root:  node marketing/splash-demo/make-demo.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { APP_SCALE, APP_VIEWPORT, brandedFrameHtml, paintStatusBars } from '../shared/brand-frame.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// ─── Tweak here ───────────────────────────────────────────────────────────────
const FPS = 60;
const LEAD_IN_S = 0.5; // plain navy before the first run
const NEXT_SCREEN_HOLD_S = 1.2; // first frame of the next screen, incl. the pause
const CROSSFADE_S = 0.5; // next screen → navy before the slow run
const SLOW_SPEED = 0.5; // second run
const SLOW_LEAD_IN_S = 0.2;
const FINAL_HOLD_S = 1.2; // next screen at the end
const LABEL_FADE_S = 0.25;
const NEXT_SCREEN_ROUTE = '/step-1'; // signed-out onboarding, no personal data
const GIF_WIDTH = 720;
const GIF_FPS = 30;

// The phone's height as a share of each format's height (the shared frame).
const FORMATS = [
  { name: '4x5', width: 1080, height: 1350, phoneHeightRatio: 0.8 },
  { name: '1x1', width: 1080, height: 1080, phoneHeightRatio: 0.8 },
];
// ──────────────────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dist = path.join(root, 'dist');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fileo-splash-demo-'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const frameMs = 1000 / FPS;

function log(...args) {
  console.log('[splash-demo]', ...args);
}

// ─── 1. Web build + a tiny static server ─────────────────────────────────────
function ensureBuild() {
  if (process.argv.includes('--rebuild') || !fs.existsSync(path.join(dist, 'index.html'))) {
    log('building the web app into dist/ …');
    const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'], {
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

// ─── 2. Capture the splash frame by frame ────────────────────────────────────
async function captureRun(browser, base, { speed, name }) {
  const dir = path.join(work, name);
  fs.mkdirSync(dir);
  const context = await browser.newContext({ viewport: APP_VIEWPORT, deviceScaleFactor: APP_SCALE, reducedMotion: 'no-preference' });
  // Signed out, offline: no requests leave the machine.
  await context.route(/supabase\.co/, (route) => route.abort());
  await context.clock.install({ time: new Date('2026-01-05T09:00:00Z') });
  await context.clock.pauseAt(new Date('2026-01-05T09:00:01Z'));
  const page = await context.newPage();
  await page.goto(`${base}${NEXT_SCREEN_ROUTE}`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');

  const state = () =>
    page.evaluate(() => {
      const root = document.querySelector('[aria-label="Fileo"]');
      if (!root) return { gone: true };
      // Zooming: F fading or gone while the O grows, and the overlay itself
      // not yet cross-fading.
      const svgs = root.querySelectorAll('svg');
      const fOpacity = parseFloat(getComputedStyle(svgs[0].parentElement).opacity);
      const oGrowing = svgs[4].getBoundingClientRect().width > svgs[0].getBoundingClientRect().width + 1;
      return { gone: false, zooming: fOpacity < 0.999 && oGrowing && parseFloat(getComputedStyle(root).opacity) >= 0.999 };
    });

  const frames = [];
  const zoomFrames = [];
  let virtualMs = 0;
  let appMs = 0;
  for (let i = 0; i < FPS * 10; i++) {
    const file = path.join(dir, `${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push(file);
    const s = await state();
    if (s.zooming) zoomFrames.push(frames.length - 1);
    if (s.gone) break; // this frame is the next screen's first
    // Advance the app's clock by one output frame (slowed down for the slow run).
    virtualMs += frameMs;
    const target = Math.round(virtualMs * speed);
    await context.clock.runFor(target - appMs);
    appMs = target;
  }
  await context.close();
  log(`${name}: ${frames.length} frames (${Math.round(appMs)}ms of app time)`);
  frames.midZoom = zoomFrames[Math.floor(zoomFrames.length / 2)];
  return frames;
}

// ─── 3. The timeline of output frames ────────────────────────────────────────
// Each output frame: screen image A, optional image B crossfaded over it,
// and the 0.5x label's opacity.
function buildTimeline(real, slow) {
  const t = [];
  const hold = (seconds, frame, extra = {}) => {
    for (let i = 0; i < Math.round(seconds * FPS); i++) t.push({ a: frame, b: null, mix: 0, label: 0, ...extra });
  };
  hold(LEAD_IN_S, real[0]);
  real.forEach((f) => t.push({ a: f, b: null, mix: 0, label: 0 }));
  hold(NEXT_SCREEN_HOLD_S, real[real.length - 1]);
  const fadeFrames = Math.round(CROSSFADE_S * FPS);
  for (let i = 1; i <= fadeFrames; i++) {
    const p = i / fadeFrames;
    t.push({ a: real[real.length - 1], b: slow[0], mix: p * p * (3 - 2 * p), label: 0 });
  }
  const slowStart = t.length;
  hold(SLOW_LEAD_IN_S, slow[0]);
  slow.forEach((f) => t.push({ a: f, b: null, mix: 0, label: 0 }));
  hold(FINAL_HOLD_S, slow[slow.length - 1]);
  t.midZoom = Math.round(LEAD_IN_S * FPS) + real.midZoom; // from the real-speed run (no label)
  // "0.5x" fades in with the slow run and out as the final hold begins.
  const labelIn = Math.round(LABEL_FADE_S * FPS);
  const slowEnd = slowStart + Math.round(SLOW_LEAD_IN_S * FPS) + slow.length;
  for (let i = slowStart; i < t.length; i++) {
    const fromStart = (i - slowStart) / labelIn;
    const toEnd = (slowEnd - i) / labelIn;
    t[i].label = Math.max(0, Math.min(1, fromStart, toEnd));
  }
  return t;
}

// ─── 4. Composite into the phone frame ───────────────────────────────────────
function demoHtml(format) {
  const page = brandedFrameHtml({
    width: format.width,
    height: format.height,
    phones: [{ src: '' }],
    options: { phoneHeightRatio: format.phoneHeightRatio },
  });
  // The "0.5x" label, top right.
  const label = `<div id="label" style="position:absolute;top:${Math.round(format.height * 0.045)}px;right:${Math.round(format.width * 0.05)}px;padding:8px 18px;border-radius:999px;
    font-size:28px;font-weight:600;letter-spacing:0.5px;color:rgba(11,22,40,0.62);border:1.5px solid rgba(11,22,40,0.14);background:rgba(255,255,255,0.45);opacity:0">0.5x</div>`;
  return page.replace('</body>', `${label}</body>`);
}

async function renderFormat(browser, base, format, timeline) {
  const dir = path.join(work, `out-${format.name}`);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(work, `demo-${format.name}.html`), demoHtml(format));
  const page = await browser.newPage({ viewport: { width: format.width, height: format.height }, deviceScaleFactor: 1 });
  await page.goto(`${base}/__work/demo-${format.name}.html`);
  await page.evaluate(() => document.fonts.ready);
  // A second screen image on top of the first, for crossfades.
  await page.evaluate(() => {
    const a = document.getElementById('img0');
    const b = a.cloneNode();
    b.id = 'img0b';
    b.removeAttribute('src');
    b.style.opacity = '0';
    a.after(b);
  });
  const src = (file) => (file ? `${base}/__work/${path.relative(work, file).split(path.sep).join('/')}` : '');
  let previous = null;
  let previousFile = null;
  for (let i = 0; i < timeline.length; i++) {
    const f = timeline[i];
    const key = `${f.a}|${f.b}|${f.mix.toFixed(4)}|${f.label.toFixed(4)}`;
    const out = path.join(dir, `${String(i).padStart(4, '0')}.png`);
    if (key === previous) {
      fs.copyFileSync(previousFile, out);
      continue;
    }
    await page.evaluate(
      async ({ a, b, mix, label }) => {
        const load = async (img, url) => {
          if (img.getAttribute('src') !== url) {
            img.setAttribute('src', url);
            if (url) await img.decode();
          }
        };
        await load(document.getElementById('img0'), a);
        await load(document.getElementById('img0b'), b);
        document.getElementById('img0b').style.opacity = String(b ? mix : 0);
        document.getElementById('label').style.opacity = String(label);
      },
      { a: src(f.a), b: src(f.b), mix: f.mix, label: f.label }
    );
    await paintStatusBars(page, 1);
    await page.screenshot({ path: out });
    previous = key;
    previousFile = out;
  }
  await page.close();
  return dir;
}

// ─── 5. Encode ───────────────────────────────────────────────────────────────
function encodeMp4(framesDir, output) {
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(framesDir, '%04d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'animation',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    '-r', String(FPS), '-movflags', '+faststart',
    output,
  ]);
}

function encodeGif(framesDir, output) {
  const palette = path.join(work, 'palette.png');
  const filters = `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`;
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%04d.png'),
    '-vf', `${filters},palettegen=max_colors=128:stats_mode=diff`, palette]);
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
    log('capturing the splash at real speed …');
    const real = await captureRun(browser, base, { speed: 1, name: 'real' });
    log(`capturing the splash at ${SLOW_SPEED}x …`);
    const slow = await captureRun(browser, base, { speed: SLOW_SPEED, name: 'slow' });
    const timeline = buildTimeline(real, slow);
    log(`timeline: ${timeline.length} frames = ${(timeline.length / FPS).toFixed(2)}s at ${FPS}fps`);
    for (const format of FORMATS) {
      log(`compositing ${format.width}x${format.height} …`);
      const frames = await renderFormat(browser, base, format, timeline);
      const mp4 = path.join(here, `fileo-splash-${format.name}.mp4`);
      encodeMp4(frames, mp4);
      log(`wrote ${path.relative(root, mp4)}`);
      if (format.name === '4x5') {
        const gif = path.join(here, 'fileo-splash.gif');
        encodeGif(frames, gif);
        log(`wrote ${path.relative(root, gif)}`);
        fs.copyFileSync(path.join(frames, `${String(timeline.midZoom).padStart(4, '0')}.png`), path.join(here, 'fileo-splash-still.png'));
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
