// The calm branded frame for social images: app screenshots in a clean phone
// frame (no device branding) on a flat heroTint background, with a very
// faint oversized "O" from the Fileo wordmark cropped off one corner, a small
// wordmark near the bottom and an optional caption above each phone.
//
// Reusable by any export script (onboarding, splash, review screen, home):
//
//   import { renderBrandedImage } from '../shared/brand-frame.mjs';
//   await renderBrandedImage(browser, {
//     width: 1080, height: 1350,
//     phones: [{ image: 'shot.png', caption: 'File in four simple steps' }],
//     out: 'marketing/x/still.png',
//     options: { monogramCorner: 'top-left' }, // any BRAND_DEFAULTS key
//   });
//
// Screenshots are of the app at PHONE.width x (PHONE.height - status bar),
// i.e. 390x797 at any device scale: the frame paints a status bar above them
// in the app's own top colour, since the web build has none.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

/** The phone the app is shown on, in app points. */
export const PHONE = { width: 390, height: 844, statusBar: 47 };
/** Capture the app at this size (below the painted status bar). */
export const APP_VIEWPORT = { width: PHONE.width, height: PHONE.height - PHONE.statusBar };

export const BRAND_DEFAULTS = {
  /** Flat page colour (heroTint). No gradient. */
  background: '#ECF2EE',
  /** Navy, for the monogram, the wordmark and captions. */
  ink: '#0B1628',
  /** The oversized "O": opacity (4-6% keeps it barely noticeable), which
   * corner it's cropped off, and its size relative to the shorter side. */
  monogramOpacity: 0.04,
  monogramCorner: 'bottom-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  monogramScale: 1.05,
  /** Small wordmark, centred near the bottom. Width in px at 1080 on the
   * shorter side (scaled with the image); 0 hides it. */
  wordmarkWidth: 104,
  wordmarkOpacity: 0.9,
  /** Captions above the phones: muted navy, medium weight. Size in px at
   * 1080 on the shorter side. */
  captionColor: 'rgba(11, 22, 40, 0.72)',
  captionSize: 40,
  captionWeight: 500,
  /** Phone height as a share of the image height. */
  phoneHeightRatio: 0.7,
  /** Phone body colour and the soft shadow under it. */
  phoneColor: '#121821',
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

function fontFaces() {
  const dir = path.join(here, 'fonts');
  const face = (file, weight) =>
    fs.existsSync(path.join(dir, file))
      ? `@font-face{font-family:'Inter';font-weight:${weight};src:url(${dataUrl(path.join(dir, file), 'font/ttf')}) format('truetype')}`
      : '';
  return face('Inter-Medium.ttf', 500) + face('Inter-SemiBold.ttf', 600);
}

// ─── Markup ──────────────────────────────────────────────────────────────────
const STATUS_ICONS = `<span class="icons">
  <svg width="1.1em" height="0.72em" viewBox="0 0 18 12"><g fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
  <svg width="1em" height="0.72em" viewBox="0 0 16 12"><path fill="currentColor" d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.9 10.9 0 0 0 8 .4 10.9 10.9 0 0 0 .5 3.4l1.2 1.3A9.1 9.1 0 0 1 8 2.2Zm0 3.5c1.5 0 2.9.6 3.9 1.5l1.2-1.3A7.4 7.4 0 0 0 8 3.9a7.4 7.4 0 0 0-5.1 2l1.2 1.3c1-.9 2.4-1.5 3.9-1.5Zm0 3.4c.6 0 1.2.2 1.6.6L8 11.6 6.4 9.7c.4-.4 1-.6 1.6-.6Z"/></svg>
  <svg width="1.6em" height="0.8em" viewBox="0 0 26 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-opacity="0.4"/><rect x="2" y="2" width="19" height="9" rx="2.2" fill="currentColor"/><path d="M24 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" fill-opacity="0.45"/></svg>
</span>`;

function pageHtml({ width, height, phones, o }) {
  const unit = Math.min(width, height) / 1080; // px per "px at 1080"
  const phoneH = Math.round(height * o.phoneHeightRatio);
  const bezel = Math.round(phoneH * 0.0125);
  const screenH = phoneH - 2 * bezel;
  const screenW = Math.round((screenH * PHONE.width) / PHONE.height);
  const phoneW = screenW + 2 * bezel;
  const radius = Math.round(phoneH * 0.075);
  const k = screenW / PHONE.width; // app points -> px
  const barH = Math.round(PHONE.statusBar * k);

  const paths = wordmarkPaths();
  const oSize = Math.round(Math.min(width, height) * o.monogramScale);
  const [vertical, horizontal] = o.monogramCorner.split('-');
  const oPos = `${vertical}:${-Math.round(oSize * 0.3)}px;${horizontal}:${-Math.round(oSize * 0.28)}px`;
  const wmW = Math.round(o.wordmarkWidth * unit);
  const wmH = Math.round((wmW * 35) / 141);

  const shadow = o.shadow
    ? `box-shadow:0 ${Math.round(phoneH * 0.035)}px ${Math.round(phoneH * 0.07)}px rgba(11,22,40,0.13),0 ${Math.round(phoneH * 0.008)}px ${Math.round(phoneH * 0.02)}px rgba(11,22,40,0.07);`
    : '';
  const hasCaptions = phones.some((p) => p.caption);
  const colW = Math.round(width / phones.length);

  const phoneMarkup = (p, i) => `
    <div class="phone">
      <div class="screen">
        ${o.statusBar ? `<div class="status" id="bar${i}"><span class="time">${o.statusBarTime}</span>${STATUS_ICONS}</div>` : ''}
        <img id="img${i}" src="${p.src}">
      </div>
      <div class="camera"></div>
    </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fontFaces()}
  *{box-sizing:border-box}
  html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
  body{background:${o.background};position:relative;font-family:Inter,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .monogram{position:absolute;${oPos};width:${oSize}px;height:${Math.round((oSize * O_BOX.h) / O_BOX.w)}px;opacity:${o.monogramOpacity}}
  .layout{position:absolute;inset:0;display:grid;grid-template-columns:repeat(${phones.length},${colW}px);
    grid-template-rows:${Math.round(height * 0.06)}px ${hasCaptions ? 'auto' : '0px'} ${hasCaptions ? Math.round(height * 0.035) : 0}px ${phoneH}px 1fr ${wmH}px ${Math.round(height * 0.045)}px}
  .caption{grid-row:2;align-self:end;justify-self:center;max-width:${Math.min(colW - Math.round(80 * unit), Math.round(phoneW * 1.9))}px;text-align:center;
    color:${o.captionColor};font-size:${Math.round(o.captionSize * unit)}px;line-height:1.25;font-weight:${o.captionWeight};letter-spacing:-0.01em;text-wrap:balance}
  .phonecell{grid-row:4;justify-self:center}
  .phone{position:relative;width:${phoneW}px;height:${phoneH}px;border-radius:${radius}px;background:${o.phoneColor};${shadow}}
  .phone::after{content:'';position:absolute;inset:0;border-radius:${radius}px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.10);pointer-events:none}
  .screen{position:absolute;left:${bezel}px;top:${bezel}px;width:${screenW}px;height:${screenH}px;border-radius:${radius - bezel}px;overflow:hidden;background:${o.phoneColor}}
  .status{position:absolute;left:0;top:0;right:0;height:${barH}px;display:flex;align-items:center;justify-content:space-between;
    padding:${Math.round(4 * k)}px ${Math.round(30 * k)}px 0 ${Math.round(36 * k)}px;font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif}
  .time{font-size:${Math.round(16 * k)}px;font-weight:600;letter-spacing:0.2px}
  .icons{display:flex;align-items:center;gap:${Math.round(6 * k)}px;font-size:${Math.round(15 * k)}px}
  .icons svg{display:block}
  .screen img{position:absolute;left:0;top:${o.statusBar ? barH : 0}px;width:100%;height:${o.statusBar ? screenH - barH : screenH}px}
  .camera{position:absolute;left:50%;top:${Math.round(bezel + screenH * 0.018)}px;width:${Math.round(screenW * 0.035)}px;height:${Math.round(screenW * 0.035)}px;
    margin-left:-${Math.round(screenW * 0.0175)}px;border-radius:50%;background:#05080D}
  .wordmark{grid-row:6;grid-column:1 / -1;justify-self:center;width:${wmW}px;height:${wmH}px;opacity:${o.wordmarkOpacity}}
  </style></head><body>
  <svg class="monogram" viewBox="${O_BOX.x} ${O_BOX.y} ${O_BOX.w} ${O_BOX.h}" preserveAspectRatio="xMidYMid meet"><path d="${letterO(paths)}" fill="${o.ink}"/></svg>
  <div class="layout">
    ${phones.map((p, i) => `${p.caption ? `<div class="caption" style="grid-column:${i + 1}">${escapeHtml(p.caption)}</div>` : ''}<div class="phonecell" style="grid-column:${i + 1}">${phoneMarkup(p, i)}</div>`).join('')}
    ${o.wordmarkWidth ? `<svg class="wordmark" viewBox="0 0 141 35">${paths.map((d) => `<path d="${d}" fill="${o.ink}"/>`).join('')}</svg>` : ''}
  </div>
  </body></html>`;
}

/**
 * Renders one image: `phones` side by side (evenly spaced), each an app
 * screenshot with an optional caption above it.
 */
export async function renderBrandedImage(browser, { width, height, phones, out, options = {} }) {
  const o = { ...BRAND_DEFAULTS, ...options };
  const withData = phones.map((p) => ({ ...p, src: dataUrl(p.image, 'image/png') }));
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(pageHtml({ width, height, phones: withData, o }), { waitUntil: 'load' });
  await page.evaluate(async (count) => {
    await document.fonts.ready;
    for (let i = 0; i < count; i++) {
      const img = document.getElementById(`img${i}`);
      await img.decode();
      const bar = document.getElementById(`bar${i}`);
      if (!bar) continue;
      // The status bar takes the colour of the app's top edge, with dark or
      // light text to match.
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, img.naturalWidth, 1, 0, 0, 8, 1);
      const px = ctx.getImageData(4, 0, 1, 1).data;
      bar.style.background = `rgb(${px[0]},${px[1]},${px[2]})`;
      const lum = (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255;
      bar.style.color = lum > 0.55 ? '#111417' : '#FFFFFF';
    }
  }, withData.length);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  await page.close();
}
