// The calm branded frame for social images and videos: app screenshots in a
// realistic, unbranded phone on a flat heroTint background, with an
// optional very faint "O" from the Fileo wordmark in one corner, a small
// wordmark and captions above the phones.
//
// The phone (phoneFrame below) is the one frame every export uses: a modern
// 6.1-inch phone, 393x852pt with a Dynamic Island-style pill, thin even
// bezel, rounded screen corners, a dark body with a subtle metallic rim,
// side buttons and a soft shadow. No logos.
//
//   import { renderBrandedImage } from '../shared/brand-frame.mjs';
//   await renderBrandedImage(browser, {
//     width: 1080, height: 1350,
//     phones: [{ image: 'shot.png', caption: 'File in four simple steps' }],
//     out: 'marketing/x/still.png',
//     options: { monogramCorner: 'top-left' }, // any BRAND_DEFAULTS key
//   });
//
// Screenshots are of the app at APP_VIEWPORT (393x793pt, any device scale):
// the frame paints the status bar above them in the app's own top colour,
// since the web build has none.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

/** The phone the app is shown on, in points (a current 6.1-inch phone). */
export const PHONE = { width: 393, height: 852, statusBar: 59, cornerRadius: 55 };
/** Capture the app at this size (below the painted status bar), at 3x. */
export const APP_VIEWPORT = { width: PHONE.width, height: PHONE.height - PHONE.statusBar };
export const APP_SCALE = 3;

export const BRAND_DEFAULTS = {
  /** Flat page colour (heroTint). No gradient. */
  background: '#ECF2EE',
  /** Navy, for the monogram, the wordmark and captions. */
  ink: '#0B1628',
  /** The faint "O": whether to show it, its opacity (about 3% keeps it
   * barely there), the corner it sits in, and its size relative to the
   * shorter side. It's placed so most of the letter shows, and reads as an O. */
  monogram: true,
  monogramOpacity: 0.03,
  monogramCorner: 'bottom-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  monogramScale: 0.36,
  /** Small wordmark: 'bottom' (centred near the bottom), 'top' or 'none'.
   * Width in px at 1080 on the shorter side. */
  wordmark: 'bottom',
  wordmarkWidth: 104,
  wordmarkOpacity: 0.9,
  /** Captions above the phones: muted navy, medium weight. Size in px at
   * 1080 on the shorter side. */
  captionColor: 'rgba(11, 22, 40, 0.72)',
  captionSize: 40,
  captionWeight: 500,
  /** Phone height as a share of the image height (centred layout). */
  phoneHeightRatio: 0.7,
  /** Place one phone exactly instead: { top, height, centerX? } in px. */
  phoneBox: null,
  /** Soft shadow under the phone. */
  shadow: true,
  /** Paint a status bar (time, signal, wifi, battery) above each screenshot. */
  statusBar: true,
  statusBarTime: '9:41',
};

// ─── Assets ──────────────────────────────────────────────────────────────────
const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const dataUrl = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;

function wordmarkPaths() {
  const svg = fs.readFileSync(path.join(root, 'assets/images/fileo-wordmark.svg'), 'utf8');
  return [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
}

/** The "O" is the wordmark's right-most letter (it starts furthest right). */
function letterO(paths) {
  const startX = (d) => parseFloat(d.slice(1));
  return paths.reduce((a, b) => (startX(b) > startX(a) ? b : a));
}

// The O's box in the wordmark's 141x35 viewBox.
const O_BOX = { x: 104.6, y: 0, w: 36.3, h: 35 };

/** @font-face rules for the bundled Inter (captions, status bar). */
export function fontFaces() {
  const dir = path.join(here, 'fonts');
  const face = (file, weight) =>
    fs.existsSync(path.join(dir, file))
      ? `@font-face{font-family:'Inter';font-weight:${weight};src:url(${dataUrl(path.join(dir, file), 'font/ttf')}) format('truetype')}`
      : '';
  return face('Inter-Medium.ttf', 500) + face('Inter-SemiBold.ttf', 600);
}

// ─── The status bar ──────────────────────────────────────────────────────────
/** Signal, wifi and battery icons (sized by the parent's font-size). */
export const STATUS_ICONS = `<span class="sb-icons">
  <svg width="1.15em" height="0.72em" viewBox="0 0 18 12"><g fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
  <svg width="1.05em" height="0.75em" viewBox="0 0 16 12"><path fill="currentColor" d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.9 10.9 0 0 0 8 .4 10.9 10.9 0 0 0 .5 3.4l1.2 1.3A9.1 9.1 0 0 1 8 2.2Zm0 3.5c1.5 0 2.9.6 3.9 1.5l1.2-1.3A7.4 7.4 0 0 0 8 3.9a7.4 7.4 0 0 0-5.1 2l1.2 1.3c1-.9 2.4-1.5 3.9-1.5Zm0 3.4c.6 0 1.2.2 1.6.6L8 11.6 6.4 9.7c.4-.4 1-.6 1.6-.6Z"/></svg>
  <svg width="1.65em" height="0.8em" viewBox="0 0 26 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.8" fill="none" stroke="currentColor" stroke-opacity="0.4"/><rect x="2" y="2" width="19" height="9" rx="2.4" fill="currentColor"/><path d="M24 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" fill-opacity="0.45"/></svg>
</span>`;

// Where things sit in the status bar, in points (393pt wide, 59pt tall).
const ISLAND = { width: 125, height: 37, top: 11 };

/**
 * A status bar k px per point wide: the time centred left of the island,
 * the icons centred right of it. `island` also draws the pill itself (on a
 * phone frame; a raw screen recording has no pill).
 */
export function statusBarHtml({ id, k, time = '9:41', island = false }) {
  const left = (PHONE.width - ISLAND.width) / 2;
  const right = left + ISLAND.width;
  const mid = ISLAND.top + ISLAND.height / 2;
  const px = (pt) => `${(pt * k).toFixed(2)}px`;
  return `<div class="sb" id="${id}" style="position:absolute;left:0;top:0;width:100%;height:${px(PHONE.statusBar)};font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif;z-index:2">
    <span style="position:absolute;left:0;width:${px(left)};top:${px(mid)};transform:translateY(-50%);text-align:center;font-size:${px(17)};font-weight:600;letter-spacing:-0.01em;padding-left:${px(14)};box-sizing:border-box">${time}</span>
    <span style="position:absolute;left:${px(right)};right:0;top:${px(mid)};transform:translateY(-50%);display:flex;justify-content:center;font-size:${px(15)};padding-right:${px(12)};box-sizing:border-box">${STATUS_ICONS}</span>
    ${island ? `<span style="position:absolute;left:${px(left)};top:${px(ISLAND.top)};width:${px(ISLAND.width)};height:${px(ISLAND.height)};border-radius:${px(ISLAND.height / 2)};background:#000"></span>` : ''}
  </div>`;
}

const STATUS_CSS = `.sb-icons{display:flex;align-items:center;gap:0.32em}.sb-icons svg{display:block}`;

// ─── The phone ───────────────────────────────────────────────────────────────
/**
 * The phone's size for a given height in px: a thin even bezel (3% of the
 * phone's width) around the 393x852pt screen.
 */
export function phoneMetrics(phoneHeight) {
  const ratio = PHONE.height / PHONE.width;
  const width = Math.round(phoneHeight / (0.94 * ratio + 0.06));
  const bezel = Math.round(width * 0.03);
  const screenW = width - 2 * bezel;
  const k = screenW / PHONE.width; // px per point
  const screenH = Math.round(PHONE.height * k);
  const height = screenH + 2 * bezel;
  const screenRadius = Math.round(PHONE.cornerRadius * k);
  return { width, height, bezel, screenW, screenH, k, screenRadius, radius: screenRadius + bezel };
}

/** CSS for phones of this size (class names .ph-*). */
export function phoneCss(m, { shadow = true } = {}) {
  const rim = Math.max(1.5, m.width * 0.0035);
  const btn = Math.max(3, Math.round(m.width * 0.006));
  return `
  .ph{position:relative;width:${m.width}px;height:${m.height}px;border-radius:${m.radius}px;
    background:linear-gradient(150deg,#5b616b 0%,#2a2e35 12%,#15171b 38%,#1c1f24 70%,#4a505a 100%);
    ${shadow ? `box-shadow:0 ${Math.round(m.height * 0.04)}px ${Math.round(m.height * 0.075)}px rgba(11,22,40,0.16),0 ${Math.round(m.height * 0.012)}px ${Math.round(m.height * 0.025)}px rgba(11,22,40,0.10),0 2px 4px rgba(11,22,40,0.06);` : ''}}
  .ph-body{position:absolute;inset:${rim}px;border-radius:${m.radius - rim}px;background:#0b0c0f;
    box-shadow:inset 0 0 0 ${rim * 0.6}px rgba(255,255,255,0.05)}
  .ph-shine{position:absolute;inset:0;border-radius:${m.radius}px;pointer-events:none;
    background:linear-gradient(160deg,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0) 22%);mix-blend-mode:screen}
  .ph-screen{position:absolute;left:${m.bezel}px;top:${m.bezel}px;width:${m.screenW}px;height:${m.screenH}px;border-radius:${m.screenRadius}px;overflow:hidden;background:#0b0c0f}
  .ph-screen img{position:absolute;left:0;width:100%}
  .ph-btn{position:absolute;width:${btn}px;border-radius:${btn}px;background:linear-gradient(90deg,#2a2e35,#4b515b,#2a2e35)}
  .ph-btn.r{right:-${btn - 1}px}.ph-btn.l{left:-${btn - 1}px}
  ${STATUS_CSS}`;
}

/** One phone's markup. The screenshot is #img{i}; the status bar #bar{i}. */
export function phoneHtml(m, { i = 0, src = '', statusBar = true, time = '9:41' } = {}) {
  const barH = PHONE.statusBar * m.k;
  const H = m.height;
  return `<div class="ph">
    <div class="ph-btn l" style="top:${Math.round(H * 0.215)}px;height:${Math.round(H * 0.065)}px"></div>
    <div class="ph-btn l" style="top:${Math.round(H * 0.295)}px;height:${Math.round(H * 0.065)}px"></div>
    <div class="ph-btn r" style="top:${Math.round(H * 0.25)}px;height:${Math.round(H * 0.105)}px"></div>
    <div class="ph-body"></div>
    <div class="ph-screen">
      ${statusBar ? statusBarHtml({ id: `bar${i}`, k: m.k, time, island: true }) : ''}
      <img id="img${i}" src="${src}" style="top:${statusBar ? barH : 0}px;height:${statusBar ? m.screenH - barH : m.screenH}px">
      ${statusBar ? '' : `<span style="position:absolute;left:${(((PHONE.width - ISLAND.width) / 2) * m.k).toFixed(2)}px;top:${(ISLAND.top * m.k).toFixed(2)}px;width:${(ISLAND.width * m.k).toFixed(2)}px;height:${(ISLAND.height * m.k).toFixed(2)}px;border-radius:999px;background:#000;z-index:2"></span>`}
    </div>
    <div class="ph-shine"></div>
  </div>`;
}

/** In the page: colour each status bar like the top edge of its screenshot. */
export async function paintStatusBars(page, count, frameSelector = null) {
  await page.evaluate(
    async ([n, frameSel]) => {
      const doc = frameSel ? document.querySelector(frameSel).contentDocument : document;
      for (let i = 0; i < n; i++) {
        const img = doc.getElementById(`img${i}`);
        await img.decode();
        const bar = doc.getElementById(`bar${i}`);
        if (!bar) continue;
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.naturalWidth, 1, 0, 0, 8, 1);
        const px = ctx.getImageData(4, 0, 1, 1).data;
        bar.style.background = `rgb(${px[0]},${px[1]},${px[2]})`;
        bar.style.color = (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255 > 0.55 ? '#111417' : '#FFFFFF';
      }
    },
    [count, frameSelector]
  );
}

// ─── The page ────────────────────────────────────────────────────────────────
function pageHtml({ width, height, phones, o }) {
  const unit = Math.min(width, height) / 1080; // px per "px at 1080"
  const m = phoneMetrics(o.phoneBox ? o.phoneBox.height : height * o.phoneHeightRatio);

  const paths = wordmarkPaths();
  const oW = Math.round(Math.min(width, height) * o.monogramScale);
  const oH = Math.round((oW * O_BOX.h) / O_BOX.w);
  const [vertical, horizontal] = o.monogramCorner.split('-');
  // Cropped off the corner by about a quarter, so the rest reads as an O.
  const oPos = `${vertical}:${-Math.round(oH * 0.24)}px;${horizontal}:${-Math.round(oW * 0.24)}px`;
  const wmW = Math.round(o.wordmarkWidth * unit);
  const wmH = Math.round((wmW * 35) / 141);
  const wordmarkSvg = (cls, style = '') =>
    `<svg class="${cls}" style="${style}" viewBox="0 0 141 35">${paths.map((d) => `<path d="${d}" fill="${o.ink}"/>`).join('')}</svg>`;

  const hasCaptions = phones.some((p) => p.caption);
  const colW = Math.round(width / phones.length);
  const bottomWordmark = o.wordmark === 'bottom' && !o.phoneBox;
  const phone = (p, i) => phoneHtml(m, { i, src: p.src, statusBar: o.statusBar, time: o.statusBarTime });

  const body = o.phoneBox
    ? `<div style="position:absolute;left:${Math.round((o.phoneBox.centerX ?? width / 2) - m.width / 2)}px;top:${o.phoneBox.top}px">${phone(phones[0], 0)}</div>`
    : `<div class="layout">
        ${phones.map((p, i) => `${p.caption ? `<div class="caption" style="grid-column:${i + 1}">${escapeHtml(p.caption)}</div>` : ''}<div class="phonecell" style="grid-column:${i + 1}">${phone(p, i)}</div>`).join('')}
        ${bottomWordmark ? wordmarkSvg('wordmark') : ''}
      </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fontFaces()}
  *{box-sizing:border-box}
  html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
  body{background:${o.background};position:relative;font-family:Inter,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .monogram{position:absolute;${oPos};width:${oW}px;height:${oH}px;opacity:${o.monogramOpacity}}
  .layout{position:absolute;inset:0;display:grid;grid-template-columns:repeat(${phones.length},${colW}px);
    grid-template-rows:${Math.round(height * 0.06)}px ${hasCaptions ? 'auto' : '0px'} ${hasCaptions ? Math.round(height * 0.035) : 0}px ${m.height}px 1fr ${bottomWordmark ? wmH : 0}px ${Math.round(height * 0.045)}px}
  .caption{grid-row:2;align-self:end;justify-self:center;max-width:${Math.min(colW - Math.round(80 * unit), Math.round(m.width * 1.9))}px;text-align:center;
    color:${o.captionColor};font-size:${Math.round(o.captionSize * unit)}px;line-height:1.25;font-weight:${o.captionWeight};letter-spacing:-0.01em;text-wrap:balance}
  .phonecell{grid-row:4;justify-self:center}
  .wordmark{grid-row:6;grid-column:1 / -1;justify-self:center;width:${wmW}px;height:${wmH}px;opacity:${o.wordmarkOpacity}}
  .wordmark-top{position:absolute;left:${Math.round(width / 2 - wmW / 2)}px;top:${Math.round(height * 0.025)}px;width:${wmW}px;height:${wmH}px;opacity:${o.wordmarkOpacity}}
  ${phoneCss(m, { shadow: o.shadow })}
  </style></head><body>
  ${o.monogram ? `<svg class="monogram" viewBox="${O_BOX.x} ${O_BOX.y} ${O_BOX.w} ${O_BOX.h}" preserveAspectRatio="xMidYMid meet"><path d="${letterO(paths)}" fill="${o.ink}"/></svg>` : ''}
  ${o.wordmark === 'top' ? wordmarkSvg('wordmark-top') : ''}
  ${body}
  </body></html>`;
}

/**
 * The frame as an HTML page, for callers that update it themselves (e.g. a
 * video that swaps the screenshot in `#img0` every frame, then calls
 * paintStatusBars). `phones[].src` is an image URL.
 */
export function brandedFrameHtml({ width, height, phones, options = {} }) {
  return pageHtml({ width, height, phones, o: { ...BRAND_DEFAULTS, ...options } });
}

/**
 * Renders one image: `phones` side by side (evenly spaced), each an app
 * screenshot (at APP_VIEWPORT) with an optional caption above it.
 */
export async function renderBrandedImage(browser, { width, height, phones, out, options = {} }) {
  const o = { ...BRAND_DEFAULTS, ...options };
  const withData = phones.map((p) => ({ ...p, src: dataUrl(p.image, 'image/png') }));
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(pageHtml({ width, height, phones: withData, o }), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await paintStatusBars(page, withData.length);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  await page.close();
}
