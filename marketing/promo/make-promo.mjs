// Renders the Fileo promo film ("Money from everywhere") from script.json.
//
// Outputs (in this folder):
//   fileo-promo-9x16.mp4 / -silent.mp4   1080x1920 (TikTok, Reels, Shorts)
//   fileo-promo-4x5.mp4  / -silent.mp4   1080x1350
//   fileo-promo-1x1.mp4  / -silent.mp4   1080x1080
//   fileo-promo-cover.jpg                1080x1920 cover
// All 60fps, H.264 (yuv420p) + AAC, mixed to -14 LUFS (true peak under -1 dB).
//
// How it works: page.mjs is the whole film as one HTML page (window.renderAt(t)
// draws any moment). Playwright renders it frame by frame and ffmpeg encodes
// the frames as they arrive. compose-audio.py writes the original score and
// sound design (numpy + scipy), which ffmpeg masters and muxes in.
//
// Real app footage lives in .work/cap (not committed). Capture it once with
// --capture, from a LOCAL/TEST backend with made-up data only:
//   - the demo account from ../review-screen (seed-demo-return.sql), signed in
//     with DEMO_EMAIL / DEMO_PASSWORD (default demo@example.com / DemoPass-2026)
//   - DEMO_DATABASE_URL (psql connection string) so the script can mark the
//     demo's three statements as "reading" and then "read", with amounts that
//     match the demo return
//   - PROMO_APP_URL: the web build served somewhere, built with
//     SHOW_TESTING_NOTICE = false. Or pass --rebuild with DEMO_SUPABASE_URL and
//     DEMO_SUPABASE_ANON_KEY set: the script flips the flag only for that build
//     (into .work/dist), then puts constants/app.ts back.
//
// Needs Node 18+, Playwright (with Chromium, or CHROMIUM_PATH=/path), ffmpeg
// (or FFMPEG=/path), and python3 with numpy and scipy.
//
// Run from the project root:
//   node marketing/promo/make-promo.mjs [--capture | --capture-only] [--rebuild] [--only 9x16,4x5] [--fps 60]
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildPage } from './page.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const work = path.join(here, '.work');
const cap = path.join(work, 'cap');
const script = JSON.parse(fs.readFileSync(path.join(here, 'script.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const FPS = Number(opt('--fps', script.fps));
const FORMATS = opt('--only', Object.keys(script.formats).join(',')).split(',');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const python = process.env.PYTHON || 'python3';
const COVER_AT = 29.2; // the number and "Deductions saved you"

const log = (...a) => console.log('[promo]', ...a);
fs.mkdirSync(cap, { recursive: true });

// ─── 1. Capture the app (optional) ───────────────────────────────────────────
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function rebuildWithoutNotice() {
  const constants = path.join(root, 'constants/app.ts');
  const original = fs.readFileSync(constants, 'utf8');
  const dist = path.join(work, 'dist');
  try {
    fs.writeFileSync(constants, original.replace(/SHOW_TESTING_NOTICE = true/, 'SHOW_TESTING_NOTICE = false'));
    log('building the web app with SHOW_TESTING_NOTICE = false …');
    const r = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', dist], {
      cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
      env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: process.env.DEMO_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.DEMO_SUPABASE_ANON_KEY },
    });
    if (r.status !== 0) throw new Error('web build failed');
  } finally {
    fs.writeFileSync(constants, original); // the app itself never changes
  }
  return dist;
}

function serve(dist) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const candidates = [url, `${url}.html`, path.join(url, 'index.html')].map((p) => path.join(dist, p));
    const file = candidates.find((p) => p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile()) ?? path.join(dist, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const psql = (sql) => execFileSync('psql', [process.env.DEMO_DATABASE_URL, '-Atqc', sql]).toString();

async function capture() {
  let base = process.env.PROMO_APP_URL;
  let server = null;
  if (flag('--rebuild') || !base) {
    server = await serve(rebuildWithoutNotice());
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const email = process.env.DEMO_EMAIL || 'demo@example.com';
  const password = process.env.DEMO_PASSWORD || 'DemoPass-2026';
  if (!process.env.DEMO_DATABASE_URL) throw new Error('--capture needs DEMO_DATABASE_URL (a local/test database)');
  const browser = await launch();
  const DSF = 6; // captured at 6x so close crops stay sharp

  // The splash, frame by frame, only the part the film shows (centred on the wordmark).
  {
    const dir = path.join(cap, `splash${FPS}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: DSF, reducedMotion: 'no-preference' });
    await ctx.clock.install({ time: new Date('2026-01-05T09:00:00Z') });
    await ctx.clock.pauseAt(new Date('2026-01-05T09:00:01Z'));
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    for (let i = 0; i < Math.round(3.5 * FPS); i++) {
      await page.screenshot({ path: path.join(dir, `${String(i).padStart(3, '0')}.png`), clip: { x: 87.76, y: 244.6, width: 216.9, height: 385.5 } });
      await ctx.clock.runFor(1000 / FPS);
    }
    await ctx.close();
  }

  // Signed in as the demo account, on a date before the 2025 deadline.
  const ctx = await browser.newContext({ viewport: { width: 393, height: 793 }, deviceScaleFactor: DSF, reducedMotion: 'no-preference', timezoneId: 'Africa/Lagos' });
  await ctx.clock.install({ time: new Date('2026-02-12T09:30:00+01:00') });
  const page = await ctx.newPage();
  const splashGone = () => page.waitForFunction(() => !document.querySelector('[aria-label="Fileo"]'), null, { timeout: 30000 });
  await page.goto(`${base}/sign-in`, { waitUntil: 'load' });
  await splashGone();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 30000 });
  await page.waitForTimeout(2000);

  // The Calculation tab, in a tall window so the whole timeline is one image.
  await page.goto(`${base}/return-review`, { waitUntil: 'load' });
  await splashGone();
  await page.getByText('Check everything before you submit').waitFor({ timeout: 30000 });
  await page.getByRole('tab', { name: 'Calculation' }).click();
  await page.setViewportSize({ width: 393, height: 1500 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(cap, 'review-calculation-tall.png') });
  await page.setViewportSize({ width: 393, height: 793 });

  // Upload Documents while the statements are read, then once they are.
  // The amounts match the demo return, so every figure in the film adds up.
  const docs = `select d.id from documents d join auth.users u on u.id = d.user_id where u.email = '${email}' and d.category in ('bank_statement', 'invoice')`;
  const amounts = `(case when d.file_name ilike 'Paystack%' then 320000000 when d.file_name ilike 'Upwork%' then 185000000 else 72000000 end)`;
  psql(`delete from document_extractions where document_id in (${docs})`);
  psql(`insert into document_extractions (document_id, user_id, status, provider, started_at) select d.id, d.user_id, 'processing', 'mock', now() from documents d where d.id in (${docs})`);
  await page.goto(`${base}/upload-documents`, { waitUntil: 'load' });
  await splashGone();
  await page.getByText(/Reading your statement/).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  fs.mkdirSync(path.join(cap, 'reading'), { recursive: true });
  for (let i = 0; i < 12; i++) {
    await page.screenshot({ path: path.join(cap, 'reading', `spin-${String(i).padStart(2, '0')}.png`) });
    await page.waitForTimeout(80);
  }
  psql(`update document_extractions e set status = 'done', period_start = '2025-01-01', period_end = '2025-12-31', currency = 'NGN', suggested_income_kobo = ${amounts}, total_inflows_kobo = ${amounts}, completed_at = now() from documents d where d.id = e.document_id and d.id in (${docs})`);
  await page.getByText(/Statement read/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(cap, 'reading', 'done.png') });

  // Home's filing card as its ring sweeps from empty, frame by frame.
  {
    const dir = path.join(cap, `ring${FPS}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await page.goto(`${base}/documents`, { waitUntil: 'load' });
    await splashGone();
    await page.waitForTimeout(1500);
    await ctx.clock.pauseAt(new Date('2026-02-12T09:35:00+01:00'));
    await page.getByText('Home', { exact: true }).last().click();
    for (let i = 0; i < Math.round(1.4 * FPS); i++) {
      await page.screenshot({ path: path.join(dir, `${String(i).padStart(3, '0')}.png`), clip: { x: 16, y: 58, width: 361, height: 262 } });
      await ctx.clock.runFor(1000 / FPS);
    }
  }
  await browser.close();
  server?.close();
  log('captured into', path.relative(root, cap));
}

// ─── 2. Audio: compose, then master to -14 LUFS ──────────────────────────────
function loudness(file, filters) {
  const out = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-af', `${filters},ebur128=peak=true`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const all = [...out.matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
  return parseFloat(all[all.length - 1][1]); // the summary's integrated loudness
}

function audio() {
  const raw = path.join(work, 'mix.wav');
  const mastered = path.join(work, 'mix-mastered.wav');
  log('composing the score …');
  execFileSync(python, [path.join(here, 'compose-audio.py'), path.join(here, 'script.json'), raw], { stdio: 'inherit' });
  // gentle compression, gain to -14 LUFS, a limiter well under 0 dBFS
  const comp = 'acompressor=threshold=0.05:ratio=2.2:attack=25:release=450:knee=4';
  const limit = 'alimiter=limit=0.75:attack=3:release=60:level=disabled';
  let gain = 10;
  for (let i = 0; i < 4; i++) gain += -14 - loudness(raw, `${comp},volume=${gain}dB,${limit}`);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', raw, '-af', `${comp},volume=${gain.toFixed(2)}dB,${limit}`, '-ar', '48000', mastered]);
  log(`audio mastered (${gain.toFixed(1)} dB gain)`);
  return mastered;
}

// ─── 3. Render each format, frame by frame, straight into ffmpeg ─────────────
async function render(format, browser, mastered) {
  const F = script.formats[format];
  const html = path.join(work, `page-${format}.html`);
  fs.writeFileSync(html, buildPage({ script, format, cap, splashDir: path.join(cap, `splash${FPS}`), ringDir: path.join(cap, `ring${FPS}`), fps: FPS }));
  const page = await browser.newPage({ viewport: { width: F.width, height: F.height }, deviceScaleFactor: 1 });
  await page.goto('file://' + html);
  await page.evaluate(() => document.fonts.ready);
  const video = path.join(work, `video-${format}.mp4`);
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', video], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => enc.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`)))));
  const frames = Math.round(script.duration * FPS);
  for (let i = 0; i < frames; i++) {
    const t = i / FPS;
    await page.evaluate(async (t) => {
      const srcs = window.frameSources(t);
      await Promise.all(Object.entries(srcs).map(([id, src]) => {
        const el = document.getElementById(id);
        if (el.getAttribute('src') === src) return null;
        el.src = src;
        return el.decode().catch(() => {});
      }));
      window.renderAt(t);
    }, t);
    const png = await page.screenshot({ type: 'png' });
    if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once('drain', r));
    if (format === '9x16' && Math.abs(t - COVER_AT) < 0.5 / FPS) await page.screenshot({ path: path.join(here, 'fileo-promo-cover.jpg'), type: 'jpeg', quality: 92 });
    if (i % (FPS * 5) === 0) log(`${format}: ${t.toFixed(0)}s / ${script.duration}s`);
  }
  enc.stdin.end();
  await done;
  await page.close();
  const out = path.join(here, `fileo-promo-${format}.mp4`);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', video, '-i', mastered, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', video, '-c:v', 'copy', '-an', '-movflags', '+faststart', path.join(here, `fileo-promo-${format}-silent.mp4`)]);
  log('wrote', path.relative(root, out), '(+ silent)');
}

if (flag('--capture') || flag('--capture-only')) await capture();
if (flag('--capture-only')) process.exit(0);
for (const need of ['review-calculation-tall.png', 'reading/done.png', `splash${FPS}/000.png`, `ring${FPS}/000.png`]) {
  if (!fs.existsSync(path.join(cap, need))) throw new Error(`missing ${need} in .work/cap: run with --capture first`);
}
const mastered = audio();
const browser = await launch();
await Promise.all(FORMATS.map((f) => render(f, browser, mastered)));
await browser.close();
log('done');
