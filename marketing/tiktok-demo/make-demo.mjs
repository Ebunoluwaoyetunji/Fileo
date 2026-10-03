// A first-time user's journey through Fileo, recorded for TikTok: splash,
// onboarding, sign-up, identity check, a whole filing with AI-read
// statements, Return Review and submit. No music, voice or captions.
//
// Outputs (in this folder):
//   fileo-first-time-framed.mp4  1080x1920, 60fps: the app in the shared phone
//                                frame (../shared/brand-frame.mjs) on the flat
//                                brand background, clear of TikTok's buttons
//                                (right 15%) and captions (bottom 20%)
//   fileo-first-time-screen.mp4  1178x2556, 60fps: the phone screen only (with
//                                a painted status bar), to place yourself
//   fileo-short-cut.mp4          the highlights, framed, about 15-20 seconds
//   timestamps.md                when each screen appears in each video
//
// How it records: the real web build is driven by Playwright with the app's
// clock under control, one frame at a time (like the splash demo), so every
// animation is smooth whatever the machine's speed. Taps show a soft
// circle, typing is paced like a person, scrolling is eased, and waits on
// the network (sign-up, uploads, AI reading) are cut so nothing looks stuck.
//
// It needs a LOCAL/TEST Supabase with made-up data only, never production:
//   - the app's migrations applied, and the edge functions served with the
//     mock providers (IDENTITY_PROVIDER=mock, AI_PROVIDER=mock)
//   - a mail catcher for the sign-up code: Mailpit (the Supabase CLI's, on
//     :54324, the default) or set DEMO_MAILBOX_URL
//   - no existing account for DEMO_EMAIL. With DEMO_DATABASE_URL set (psql
//     connection string), the script deletes that test user first.
// Build the web app against it first, or pass --rebuild with
// DEMO_SUPABASE_URL and DEMO_SUPABASE_ANON_KEY set.
//
// Needs: Node 18+, Playwright (npm i -D playwright; npx playwright install
// chromium), ffmpeg on the PATH (or FFMPEG=...), and psql if you use
// DEMO_DATABASE_URL.
//
// Run from the project root:  node marketing/tiktok-demo/make-demo.mjs
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { APP_SCALE, APP_VIEWPORT, brandedFrameHtml, fontFaces, PHONE, statusBarHtml } from '../shared/brand-frame.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// ─── Tweak here ───────────────────────────────────────────────────────────────
const FPS = 60;
/** The app's clock: a morning 49 days before the 2025 deadline. */
const DEMO_TIME = '2026-02-10T09:00:00+01:00';
/** Made-up user. The NIN and BVN pass the mock identity check (any 11
 * digits not ending in 0000, 1111 or 9999). */
const USER = {
  name: 'Tolu Bakare',
  email: process.env.DEMO_EMAIL || 'tolu.bakare@example.com',
  phone: '+234 801 234 5678',
  password: 'Fileo-Demo-2026',
  nin: '12345678901',
  bvn: '22345678912',
  pension: '420000',
};
/** Typing speed: frames per character (plus a little variation). */
const TYPE_FRAMES = 3;
/** The framed video. The app is recorded at a real phone's size (393x852pt
 * at 3x, from ../shared/brand-frame.mjs) and shown in the shared phone frame. */
const OUT = { width: 1080, height: 1920 };
/** Where the phone sits: big, centred, 100px from the top. TikTok covers the
 * right ~15% (buttons) and bottom ~20% (caption): at 1420px tall the whole
 * phone ends above y=1536 and right of centre stays left of x=918. */
const PHONE_BOX = { top: 100, height: 1420 };
/** No wordmark (TikTok's captions cover the bottom) and no "O": the phone
 * fills the frame, so the flat background reads best. */
const BRAND_OPTIONS = { phoneBox: PHONE_BOX, wordmark: 'none', monogram: false };
/** The screen-only video: the whole phone screen at 3x (status bar painted,
 * no frame), 1178x2556 (H.264 needs even sizes; 1px of the 1179 trimmed). */
const RAW = { width: 1178, height: Math.round(PHONE.height * APP_SCALE) };
/** The highlights for the short cut: [from marker, to marker or +seconds, speed]. */
const SHORT_CUT = [
  { from: 'Splash', to: 'Onboarding 1', speed: 1.15 },
  { from: 'Onboarding 1', to: 'Create account', speed: 2.6 },
  { from: 'Home', seconds: 2.0, speed: 1 },
  { from: 'Income summary', seconds: 2.6, speed: 1 },
  { from: 'Return review', to: 'Submit', speed: 1.6 },
  { from: 'Confirmation', seconds: 3.0, speed: 1 },
];
// ──────────────────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dist = path.join(root, 'dist');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fileo-tiktok-'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const MAILBOX = process.env.DEMO_MAILBOX_URL || 'http://127.0.0.1:54324';
const frameMs = 1000 / FPS;
const BAR_PX = Math.round(PHONE.statusBar * APP_SCALE);
/** The compositor page: the raw screen on the left, the framed video at RAW_SLOT. */
const RAW_SLOT = 1180;
const PAGE = { width: RAW_SLOT + OUT.width, height: RAW.height };
const log = (...args) => console.log('[tiktok-demo]', ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Web build + a tiny static server ────────────────────────────────────────
function ensureBuild() {
  if (process.argv.includes('--rebuild') || !fs.existsSync(path.join(dist, 'index.html'))) {
    if (!process.env.DEMO_SUPABASE_URL || !process.env.DEMO_SUPABASE_ANON_KEY) {
      throw new Error('To build, set DEMO_SUPABASE_URL and DEMO_SUPABASE_ANON_KEY (a local/test backend), or build dist/ yourself.');
    }
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

// ─── Made-up documents and the sign-up code ──────────────────────────────────
/** A one-page PDF with a few lines of text: obviously a sample. */
function samplePdf(lines) {
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 56 ${780 - i * 22} Td (${l.replace(/[()\\]/g, '')}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function sampleFile(name, title) {
  const file = path.join(work, name);
  fs.writeFileSync(file, samplePdf([title, 'SAMPLE - made-up data for a demo video']));
  return file;
}

async function signUpCode(email) {
  for (let i = 0; i < 60; i++) {
    try {
      if (/\/messages$/.test(MAILBOX)) {
        // A simple catcher returning [{ to, code }].
        const list = await (await fetch(MAILBOX)).json();
        const message = list.filter((m) => (m.to || '').includes(email)).pop();
        if (message?.code) return message.code;
      } else {
        // Mailpit (Supabase CLI).
        const list = await (await fetch(`${MAILBOX}/api/v1/messages`)).json();
        const message = (list.messages || []).find((m) => (m.To || []).some((t) => t.Address === email));
        if (message) {
          const full = await (await fetch(`${MAILBOX}/api/v1/message/${message.ID}`)).json();
          const code = `${full.Text || ''} ${full.HTML || ''}`.match(/\b\d{6}\b/);
          if (code) return code[0];
        }
      }
    } catch {
      // not there yet
    }
    await sleep(500);
  }
  throw new Error(`No sign-up code for ${email} at ${MAILBOX}`);
}

function deleteDemoUser() {
  if (!process.env.DEMO_DATABASE_URL) {
    log(`DEMO_DATABASE_URL not set: make sure ${USER.email} doesn't exist yet.`);
    return;
  }
  execFileSync('psql', [process.env.DEMO_DATABASE_URL, '-q', '-c', `delete from auth.users where email = '${USER.email.replace(/'/g, "''")}'`], { stdio: 'inherit' });
}

// ─── Compositing: framed and raw, one screenshot per frame ───────────────────
function compositorHtml() {
  const framed = brandedFrameHtml({ width: OUT.width, height: OUT.height, phones: [{ src: '' }], options: BRAND_OPTIONS });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fontFaces()}
  html,body{margin:0;width:${PAGE.width}px;height:${PAGE.height}px;overflow:hidden;background:#fff}
  #raw{position:absolute;left:0;top:0;width:${Math.round(PHONE.width * APP_SCALE)}px;height:${RAW.height}px;overflow:hidden;background:#fff}
  .sb-icons{display:flex;align-items:center;gap:0.32em}.sb-icons svg{display:block}
  #rawimg{position:absolute;left:0;top:${BAR_PX}px;width:100%;height:${RAW.height - BAR_PX}px}
  iframe{position:absolute;left:${RAW_SLOT}px;top:0;width:${OUT.width}px;height:${OUT.height}px;border:0}
  </style></head><body>
  <div id="raw">${statusBarHtml({ id: 'rawbar', k: APP_SCALE })}<img id="rawimg"></div>
  <iframe id="framed" srcdoc="${framed.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>
  </body></html>`;
}

async function openCompositor(browser) {
  fs.writeFileSync(path.join(work, 'compositor.html'), compositorHtml());
  const page = await browser.newPage({ viewport: PAGE, deviceScaleFactor: 1 });
  return page;
}

/** Puts one app frame into both outputs (status bars take the app's top colour). */
async function composeFrame(page, jpeg) {
  await page.evaluate(async (src) => {
    const raw = document.getElementById('rawimg');
    const doc = document.getElementById('framed').contentDocument;
    const img = doc.getElementById('img0');
    raw.src = src;
    img.src = src;
    await Promise.all([raw.decode(), img.decode()]);
    const canvas = (window.__canvas ||= Object.assign(document.createElement('canvas'), { width: 8, height: 1 }));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(raw, 0, 0, raw.naturalWidth, 1, 0, 0, 8, 1);
    const px = ctx.getImageData(4, 0, 1, 1).data;
    const bg = `rgb(${px[0]},${px[1]},${px[2]})`;
    const fg = (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255 > 0.55 ? '#111417' : '#FFFFFF';
    for (const bar of [document.getElementById('rawbar'), doc.getElementById('bar0')]) {
      bar.style.background = bg;
      bar.style.color = fg;
    }
  }, `data:image/jpeg;base64,${jpeg.toString('base64')}`);
  return page.screenshot({ type: 'jpeg', quality: 93 });
}

function startEncoder() {
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-filter_complex', `[0:v]split=2[a][b];[a]crop=${OUT.width}:${OUT.height}:${RAW_SLOT}:0[framed];[b]crop=${RAW.width}:${RAW.height}:0:0[raw]`,
  ];
  const encode = (label, file) => [
    '-map', `[${label}]`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-level', label === 'raw' ? '5.1' : '4.2', '-r', String(FPS), '-movflags', '+faststart', file,
  ];
  const proc = spawn(ffmpeg, [...args, ...encode('framed', path.join(here, 'fileo-first-time-framed.mp4')), ...encode('raw', path.join(here, 'fileo-first-time-screen.mp4'))], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
  done.catch(() => {}); // reported by end(); a kill after a failure isn't news
  return {
    kill: () => proc.kill('SIGKILL'),
    write: (buf) => (proc.stdin.write(buf) ? Promise.resolve() : new Promise((r) => proc.stdin.once('drain', r))),
    end: () => {
      proc.stdin.end();
      return done;
    },
  };
}

// ─── The recorder: frames, taps, typing, scrolling, cut waits ────────────────
class Recorder {
  constructor({ page, context, cdp, compositor, encoder }) {
    Object.assign(this, { page, context, cdp, compositor, encoder });
    this.frames = 0;
    this.appMs = 0; // app time since recording started
    this.clockMs = 0;
    this.tap = null; // { x, y, frame, drag }
    this.markers = [];
    this.seed = 7;
    this.realStart = Date.now();
    this.rate = 0.1;
  }

  async advance(ms) {
    this.appMs += ms;
    const target = Math.round(this.appMs);
    if (target > this.clockMs) {
      await this.context.clock.runFor(target - this.clockMs);
      this.clockMs = target;
    }
  }

  /** CSS animations (sheets sliding in) run on real time, not the app's
   * clock: slow them to match how long a frame takes to capture. */
  async setCssRate(rate) {
    this.rate = rate;
    await this.cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
  }

  async drawTap() {
    const t = this.tap;
    const age = t ? (this.frames - t.frame) * frameMs : Infinity;
    await this.page.evaluate(([tap, a]) => {
      const dot = document.getElementById('__tap');
      if (!dot) return;
      const life = 420;
      if (!tap || (!tap.drag && a >= life)) {
        dot.style.opacity = '0';
        return;
      }
      const k = tap.drag ? 0.4 : Math.min(a / life, 1);
      dot.style.left = `${tap.x}px`;
      dot.style.top = `${tap.y}px`;
      dot.style.opacity = String(tap.drag ? 0.9 : 0.9 * (1 - k * k));
      dot.style.transform = `scale(${0.7 + 0.55 * (1 - Math.pow(1 - k, 2))})`;
    }, [t, age]);
  }

  async frame() {
    await this.drawTap();
    const shot = await this.page.screenshot({ type: 'jpeg', quality: 92 });
    const composed = await composeFrame(this.compositor, shot);
    await this.encoder.write(composed);
    this.frames += 1;
    await this.advance(frameMs);
    if (this.frames % 30 === 0) {
      const realPerFrame = (Date.now() - this.realStart) / this.frames;
      await this.setCssRate(Math.min(1, Math.max(0.02, frameMs / realPerFrame)));
    }
    if (this.frames % 600 === 0) log(`${this.frames} frames (${(this.frames / FPS).toFixed(1)}s)`);
  }

  async hold(seconds) {
    for (let i = 0; i < Math.round(seconds * FPS); i++) await this.frame();
  }

  mark(label) {
    this.markers.push({ label, frame: this.frames });
    log(`${(this.frames / FPS).toFixed(2)}s ${label}`);
  }

  /** Wait for something without recording it (cuts network waits), after
   * showing at most `show` seconds of it. */
  async until(check, { show = 0.25, timeout = 60000, step = 50 } = {}) {
    for (let i = 0; i < Math.round(show * FPS); i++) {
      if (await check()) return;
      await this.frame();
    }
    const start = Date.now();
    const rate = this.rate;
    await this.setCssRate(1);
    while (!(await check())) {
      if (Date.now() - start > timeout) throw new Error('timed out waiting');
      if (step) await this.advance(step);
      await sleep(30);
    }
    await this.setCssRate(rate);
  }

  visible(locator) {
    return () => locator.first().isVisible().catch(() => false);
  }

  random() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** The scrollable element holding `handle` (or the screen's main one). */
  async scroller(locator) {
    return locator.first().evaluateHandle((el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 2) return n;
      }
      return null;
    });
  }

  async smoothScroll(scroller, to, seconds) {
    const from = await scroller.evaluate((el) => el.scrollTop);
    const max = await scroller.evaluate((el) => el.scrollHeight - el.clientHeight);
    const target = Math.max(0, Math.min(max, to));
    const n = Math.max(1, Math.round(seconds * FPS));
    for (let i = 1; i <= n; i++) {
      const x = i / n;
      const eased = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      await scroller.evaluate((el, y) => {
        el.scrollTop = y;
      }, from + (target - from) * eased);
      await this.frame();
    }
  }

  /** Brings an element into the comfortable middle of the screen, smoothly. */
  async reveal(locator, { top = 90, bottom = 120 } = {}) {
    const box = await locator.first().boundingBox();
    if (!box) throw new Error('element not on screen');
    const vh = APP_VIEWPORT.height;
    if (box.y >= top && box.y + box.height <= vh - bottom) return;
    const scroller = await this.scroller(locator);
    if (!(await scroller.evaluate((el) => !!el))) return;
    const current = await scroller.evaluate((el) => el.scrollTop);
    const delta = box.y + box.height / 2 - vh * 0.45;
    await this.smoothScroll(scroller, current + delta, Math.min(0.9, 0.35 + Math.abs(delta) / 900));
  }

  async scrollBy(locator, dy, seconds) {
    const scroller = await this.scroller(locator);
    const current = await scroller.evaluate((el) => el.scrollTop);
    await this.smoothScroll(scroller, current + dy, seconds);
  }

  async tapAt(x, y) {
    this.tap = { x, y, frame: this.frames };
    for (let i = 0; i < 4; i++) await this.frame(); // the touch lands, then the app reacts
    await this.page.mouse.click(x, y);
  }

  async tapOn(locator, options) {
    await this.reveal(locator, options);
    const box = await locator.first().boundingBox();
    await this.tapAt(box.x + box.width / 2, box.y + box.height / 2);
  }

  async type(locator, text) {
    await this.tapOn(locator);
    await this.hold(0.12);
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      const n = TYPE_FRAMES + (this.random() < 0.25 ? 2 : 0) + (ch === ' ' || ch === '@' || ch === '.' ? 2 : 0);
      for (let i = 0; i < n; i++) await this.frame();
    }
  }

  /** A finger swipe (touch events: the carousel's pan gesture ignores the
   * mouse), one frame per move so the gesture has time between points. */
  async swipeLeft(y = APP_VIEWPORT.height * 0.45) {
    const x0 = APP_VIEWPORT.width * 0.8;
    const x1 = APP_VIEWPORT.width * 0.18;
    const touch = (type, x, yy) =>
      this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: yy }] });
    this.tap = { x: x0, y, frame: this.frames, drag: true };
    await touch('touchStart', x0, y);
    await this.frame();
    const n = 14;
    for (let i = 1; i <= n; i++) {
      const k = 1 - Math.pow(1 - i / n, 2);
      const x = x0 + (x1 - x0) * k;
      this.tap = { x, y: y + i, frame: this.frames, drag: true };
      await touch('touchMove', x, y + i);
      await this.frame();
    }
    await touch('touchEnd');
    this.tap = { x: x1, y: y + n, frame: this.frames };
  }

  /** Upload button → "Add a document" sheet → Choose a file → the file. */
  async upload(trigger, file) {
    await this.tapOn(trigger);
    await this.hold(0.55);
    let chooser = null;
    const chooserPromise = this.page.waitForEvent('filechooser', { timeout: 30000 }).then((c) => (chooser = c));
    await this.tapOn(this.page.getByRole('button', { name: 'Choose a file', exact: true }));
    for (let i = 0; i < 30 && !chooser; i++) await this.frame();
    await chooserPromise;
    await chooser.setFiles(file);
  }
}

// ─── The journey ─────────────────────────────────────────────────────────────
async function journey(r, files) {
  const { page } = r;
  const button = (name) => page.getByRole('button', { name, exact: true });
  const text = (t) => page.getByText(t, { exact: typeof t === 'string' });

  // 1. Splash: bouncing ball, then the zoom into the O.
  await r.until(() => page.evaluate(() => !!document.querySelector('[aria-label="Fileo"]')), { show: 0, step: 2 });
  r.mark('Splash');
  while (await page.evaluate(() => !!document.querySelector('[aria-label="Fileo"]'))) await r.frame();

  // 2. Onboarding, swiping through.
  await r.until(r.visible(text('File Your Taxes Without the Stress')), { show: 0 });
  r.mark('Onboarding 1');
  await r.hold(1.7);
  await r.swipeLeft();
  await r.until(r.visible(text('File in Five Simple Steps')), { show: 0.3 });
  r.mark('Onboarding 2');
  await r.hold(1.6);
  await r.swipeLeft();
  await r.until(r.visible(text('Your Data Is Safe')), { show: 0.3 });
  r.mark('Onboarding 3');
  await r.hold(1.4);
  await r.tapOn(button('Create Account'));

  // 3. Create account.
  await r.until(r.visible(page.getByPlaceholder('Ada Lovelace')));
  r.mark('Create account');
  await r.hold(0.5);
  await r.type(page.getByPlaceholder('Ada Lovelace'), USER.name);
  await r.type(page.getByPlaceholder('you@example.com'), USER.email);
  await r.type(page.getByPlaceholder('+234 800 000 0000'), USER.phone);
  await r.type(page.getByPlaceholder('Create a password'), USER.password);
  await r.type(page.getByPlaceholder('Re-enter your password'), USER.password);
  await r.hold(0.35);
  await r.tapOn(button('Create Account'));

  // 4. The code from the email.
  await r.until(r.visible(text('Verification Code')));
  r.mark('Verification code');
  const code = await signUpCode(USER.email);
  await r.hold(0.6);
  await r.tapOn(page.locator('input:visible').first());
  for (const digit of code) {
    await page.keyboard.type(digit);
    await r.hold(0.1);
  }
  await r.hold(0.35);
  await r.tapOn(button('Verify'));

  // 5. Identity check (mock).
  await r.until(r.visible(page.getByPlaceholder('Enter your 11-digit NIN')));
  r.mark('Identity check');
  await r.hold(0.5);
  await r.type(page.getByPlaceholder('Enter your 11-digit NIN'), USER.nin);
  await r.type(page.getByPlaceholder('Enter your 11-digit BVN'), USER.bvn);
  await r.hold(0.3);
  await r.tapOn(button('Continue'));

  // 6. Home, not started.
  await r.until(r.visible(button('Start filing')), { show: 0.4 });
  r.mark('Home');
  await r.hold(2.6);
  await r.tapOn(button('Start filing'));

  // 7. Platforms.
  await r.until(r.visible(text('Select all the platforms you received payments from')));
  r.mark('Select platforms');
  await r.hold(0.8);
  await r.tapOn(text('Paystack').first());
  await r.hold(0.35);
  await r.tapOn(text('Upwork').first());
  await r.hold(0.5);
  await r.tapOn(button('Continue'));

  // First statement: the app asks before AI reads anything.
  await r.until(async () => (await r.visible(text('Let Fileo read your statements?'))()) || (await r.visible(text('Upload your tax documents'))()));
  if (await r.visible(text('Let Fileo read your statements?'))()) {
    r.mark('Allow statement reading');
    await r.hold(1.3);
    await r.tapOn(button('Allow'));
  }

  // 8. Upload both statements; AI reads them.
  await r.until(r.visible(text('Upload your tax documents')));
  r.mark('Upload documents');
  await r.hold(0.8);
  // Reading (or, if the AI was quick, already read) for `n` statements.
  const progress = (n) => async () =>
    (await page.getByText(/Reading your statement/).count()) + (await page.getByText(/^Statement read/).count()) >= n;
  await r.upload(button('Upload'), files.paystack);
  await r.until(progress(1), { show: 0.4 });
  await r.hold(0.9);
  await r.upload(button('Upload'), files.upwork);
  await r.until(progress(2), { show: 0.4 });
  await r.hold(0.7);
  await r.until(async () => (await page.getByText(/^Statement read/).count()) >= 2, { show: 0.3 });
  r.mark('Statements read');
  await r.hold(1.3);
  await r.tapOn(button('Continue'));

  // 9. Income Summary, pre-filled by AI.
  await r.until(r.visible(text('Review your income')));
  await r.until(r.visible(page.getByText(/Suggested from your statement/)), { show: 0.2 });
  r.mark('Income summary');
  await r.hold(1.8);
  await r.tapOn(page.getByText(/I confirm these amounts/));
  await r.hold(0.6);
  await r.tapOn(button('Continue'));
  await r.until(async () => (await r.visible(text('All transactions reviewed'))()) || (await r.visible(page.getByText(/reduce what you owe/))()));
  if (await r.visible(text('All transactions reviewed'))()) {
    await r.hold(0.9);
    await r.tapOn(button('Continue').last());
  }

  // 10. Deductions: pension, with its statement.
  await r.until(r.visible(page.getByText(/reduce what you owe/)));
  r.mark('Deductions');
  await r.hold(1.0);
  await r.tapOn(page.getByRole('switch').nth(2));
  await r.hold(0.5);
  await r.type(page.getByLabel('Pension contributions: amount paid in naira'), USER.pension);
  await r.hold(0.3);
  await r.upload(page.getByText(/Upload your PFA statement/), files.pension);
  await r.until(r.visible(text('Document uploaded')), { show: 0.4 });
  await r.hold(0.9);
  await r.tapOn(button('Continue'));

  // 11. Return Review.
  await r.until(r.visible(page.getByRole('tab', { name: 'Summary' })), { show: 0.3 });
  await r.until(r.visible(page.getByText(/Check everything before you submit/)), { show: 0 });
  r.mark('Return review');
  await r.hold(2.3);
  await r.tapOn(page.getByRole('tab', { name: 'Calculation' }));
  r.mark('Calculation tab');
  await r.hold(1.1);
  await r.reveal(button('How tax bands work'), { bottom: 150 });
  await r.hold(0.5);
  await r.tapOn(button('How tax bands work'), { bottom: 150 });
  r.mark('How tax bands work');
  await r.hold(1.9);
  await r.tapOn(button('Got it'));
  await r.hold(0.5);
  await r.tapOn(page.getByRole('tab', { name: 'Documents' }), { top: 60 });
  r.mark('Documents tab');
  await r.hold(1.5);

  // 12. Submit.
  await r.tapOn(button('Approve and submit'), { bottom: 0 });
  r.mark('Submit');
  await r.hold(1.3);
  await r.tapOn(button('Yes, submit my return'), { bottom: 0 });

  // 13. Confirmation, with the reference number.
  await r.until(r.visible(text('Reference number')), { show: 0.3 });
  r.mark('Confirmation');
  await r.hold(3.6);
}

// ─── Short cut and timestamps ────────────────────────────────────────────────
const clock = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

function shortCut(markers, totalFrames) {
  const at = (label) => {
    const m = markers.find((x) => x.label === label);
    if (!m) throw new Error(`no marker ${label}`);
    return m.frame / FPS;
  };
  const segments = SHORT_CUT.map((s) => {
    const start = at(s.from);
    const end = s.to ? at(s.to) : Math.min(start + s.seconds, totalFrames / FPS);
    return { ...s, start, end };
  });
  const filters = segments.map((s, i) => `[0:v]trim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},setpts=(PTS-STARTPTS)/${s.speed},fps=${FPS}[s${i}]`);
  const concat = `${segments.map((_, i) => `[s${i}]`).join('')}concat=n=${segments.length}:v=1:a=0[out]`;
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error', '-i', path.join(here, 'fileo-first-time-framed.mp4'),
    '-filter_complex', [...filters, concat].join(';'), '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    '-r', String(FPS), '-movflags', '+faststart', path.join(here, 'fileo-short-cut.mp4'),
  ]);
  // Where each segment starts in the cut.
  let t = 0;
  return segments.map((s) => {
    const row = { label: s.from, at: t };
    t += (s.end - s.start) / s.speed;
    return row;
  }).concat([{ label: 'End', at: t }]);
}

function writeTimestamps(markers, totalFrames, cutRows) {
  const full = markers.map((m) => `- ${clock(m.frame / FPS)} ${m.label}`).join('\n');
  const cut = cutRows.map((row) => `- ${clock(row.at)} ${row.label}`).join('\n');
  fs.writeFileSync(
    path.join(here, 'timestamps.md'),
    `# TikTok demo: timestamps

## fileo-first-time-framed.mp4 and fileo-first-time-screen.mp4

Both have the same timing (${clock(totalFrames / FPS)} long).

${full}
- ${clock(totalFrames / FPS)} End

## fileo-short-cut.mp4

${cut}
`
  );
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  ensureBuild();
  deleteDemoUser();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const files = {
    paystack: sampleFile('Paystack statement 2025.pdf', 'Paystack settlement statement 2025'),
    upwork: sampleFile('Upwork statement 2025.pdf', 'Upwork earnings statement 2025'),
    pension: sampleFile('PFA statement 2025.pdf', 'Pension contributions statement 2025'),
  };
  const encoder = startEncoder();
  let encoded = false;
  try {
    const compositor = await openCompositor(browser);
    await compositor.goto(`${base}/__work/compositor.html`);
    await compositor.evaluate(() => document.fonts.ready);

    const context = await browser.newContext({ viewport: APP_VIEWPORT, deviceScaleFactor: APP_SCALE, hasTouch: true, timezoneId: 'Africa/Lagos', locale: 'en-NG', reducedMotion: 'no-preference' });
    const startMs = new Date(DEMO_TIME).getTime();
    await context.clock.install({ time: startMs });
    await context.clock.pauseAt(startMs + 1000);
    // The submitted time comes from the server's real clock: show the demo
    // clock's time instead, so the dates on screen agree.
    let recorder = null;
    await context.route('**/rest/v1/rpc/submit_filing', async (route) => {
      const response = await route.fetch();
      let body = await response.json();
      const now = new Date(startMs + 1000 + (recorder?.clockMs ?? 0)).toISOString();
      body = Array.isArray(body) ? body.map((row) => ({ ...row, submitted_at: now })) : { ...body, submitted_at: now };
      await route.fulfill({ response, json: body });
    });
    // The onboarding carousel auto-advances after 4.5s, and step 1 mounts
    // under the splash: switch off just that timer, so the swipes drive it.
    await context.addInitScript(() => {
      const original = window.setTimeout;
      window.setTimeout = (fn, delay, ...args) => (delay === 4500 ? 0 : original(fn, delay, ...args));
    });
    // The tap marker: a soft translucent circle, never part of the app.
    await context.addInitScript(() => {
      const add = () => {
        if (document.getElementById('__tap') || !document.body) return;
        const dot = document.createElement('div');
        dot.id = '__tap';
        dot.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(11,22,40,0.16);border:1.5px solid rgba(11,22,40,0.22);pointer-events:none;opacity:0;z-index:2147483647';
        document.body.appendChild(dot);
      };
      document.addEventListener('DOMContentLoaded', add);
      add();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => {
      if (!/Minified React error #418/.test(e.message)) log('page error:', e.message.slice(0, 200));
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Animation.enable');
    recorder = new Recorder({ page, context, cdp, compositor, encoder });
    await recorder.setCssRate(0.1);
    await page.goto(`${base}/`, { waitUntil: 'load' });

    try {
      await journey(recorder, files);
    } catch (error) {
      // Where it got stuck, for fixing selectors after a design change.
      await page.screenshot({ path: path.join(here, 'failed-at.png') }).catch(() => {});
      log(`stopped after ${(recorder.frames / FPS).toFixed(1)}s; screenshot in failed-at.png`);
      throw error;
    }
    await encoder.end();
    encoded = true;
    log(`recorded ${recorder.frames} frames (${(recorder.frames / FPS).toFixed(1)}s) in ${Math.round((Date.now() - recorder.realStart) / 1000)}s`);

    const cutRows = shortCut(recorder.markers, recorder.frames);
    writeTimestamps(recorder.markers, recorder.frames, cutRows);
    log('wrote fileo-first-time-framed.mp4, fileo-first-time-screen.mp4, fileo-short-cut.mp4, timestamps.md');
    await context.close();
  } finally {
    if (!encoded) encoder.kill();
    await browser.close();
    server.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
