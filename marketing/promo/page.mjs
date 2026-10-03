// The Fileo promo as one HTML page: window.renderAt(t) draws any moment of
// the film. All text and timings come from script.json; make-promo.mjs
// renders it frame by frame in each format.
//
// Story: payment notifications pile up, then an urgent tax-due alert, which
// becomes Fileo's green ball. The app's real splash. Then one continuous
// canvas of brand-colour sections that the camera glides down, with an
// animated ribbon, real app footage (6x captures), and the ball leading:
// upload, the statement read, the total, the ring, the calculation, the tax
// bands, the number, and the logo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { phoneCss, phoneHtml, phoneMetrics } from '../shared/brand-frame.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const b64 = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;

export const C = {
  navy: '#0B1628', green: '#0B6E4F', mint: '#5FC79B', heroTint: '#ECF2EE', greenLight: '#E3F3EC',
  ball: '#129A6F', text: '#111417', textSecondary: '#5B6470', border: '#E4E7EB',
};
export const CX = 540; // the film is laid out on a 1080x1920 stage, centred here

/**
 * The page for one format. `cap` holds the app captures (see make-promo.mjs
 * --capture); `splashDir`/`ringDir` hold frame sequences captured at `fps`.
 */
export function buildPage({ script, format, cap, splashDir, ringDir, fps }) {
  const W = 1080, H = 1920; // the stage
  const F = script.formats[format];
  const FW = F.width, FH = F.height, KS = F.scale, STX = FW / 2 - CX * KS, STY = F.centerY - 800 * KS;
  const T = script.timings, X = script.text, STATEMENT = script.statement.rows, FIG = script.figures, AL = script.alert;
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const m = phoneMetrics(1450);
  const appPhone = phoneHtml(m, { i: 0, src: `${cap}/reading/done.png`, statusBar: true });
  const oMark = `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(ROOT + '/assets/images/fileo-wordmark.svg', 'utf8').replace(/width="141" height="35" viewBox="0 0 141 35"/, 'width="363" height="350" viewBox="104.6 0 36.3 35"').replaceAll('#FAFAF8', C.navy)).toString('base64')}`;
  const navyMark = `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(ROOT + '/assets/images/fileo-wordmark.svg', 'utf8').replaceAll('#FAFAF8', C.navy)).toString('base64')}`;
  const SPR = {
    readCard: [`${cap}/reading/done.png`, 144, 1690, 2070, 720],
    calc: [`${cap}/review-calculation-tall.png`, 144, 2227, 2070, 3270],
  };
  const sprite = (id, [src, sx, sy, sw, sh], k, extra = '') =>
    `<div class="abs sprite" id="${id}" style="width:${sw * k}px;height:${sh * k}px;${extra}"><img src="${src}" style="left:${-sx * k}px;top:${-sy * k}px;width:${2358 * k}px"></div>`;
  const check = (c, sz) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;

  // The canvas after the splash: sections stacked top to bottom.
  const SECTIONS = [
    ['up', C.green, 1920], ['doc', C.mint, 1920], ['total', C.navy, 1920], ['home', C.mint, 1920], ['why', C.navy, 1920],
    ['rows', C.green, 2620], ['bands', C.navy, 1920], ['number', C.green, 1920], ['close', C.heroTint, 1920],
  ];
  // Each section gets extra colour above and below its content, so a held
  // moment shows one colour even when the stage is scaled down for a format.
  const PAD_T = 420, PAD_B = 320;
  const Y = {};
  let acc = 0;
  for (const [id, , h] of SECTIONS) { Y[id] = acc + PAD_T; acc += PAD_T + h + PAD_B; }
  const worldH = acc;
  const k = 0.405; // calc sprite scale
  const txt = (id, html, y, size, color, extra = '') =>
    `<div class="abs ln" id="${id}" style="left:0;top:${y}px;width:${W}px;text-align:center;font-size:${size}px;color:${color};${extra}">${html}</div>`;
  const pf = (id, html, y, size, color) => txt(id, html, y, size, color, "font-family:'Playfair';font-weight:700;letter-spacing:-0.015em;line-height:1.05");
  const it = (id, html, y, size, color, w = 500) => txt(id, html, y, size, color, `font-family:'Inter';font-weight:${w}`);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Playfair';font-weight:700;src:url(${b64(ROOT + '/assets/fonts/PlayfairDisplay-Bold.ttf', 'font/ttf')})}
@font-face{font-family:'Inter';font-weight:500;src:url(${b64(ROOT + '/marketing/shared/fonts/Inter-Medium.ttf', 'font/ttf')})}
@font-face{font-family:'Inter';font-weight:600;src:url(${b64(ROOT + '/marketing/shared/fonts/Inter-SemiBold.ttf', 'font/ttf')})}
*{box-sizing:border-box;margin:0}
html,body{width:${FW}px;height:${FH}px;overflow:hidden;background:${C.navy};-webkit-font-smoothing:antialiased}
.scene{position:absolute;inset:0;overflow:hidden;display:none}
.stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;transform:translate(${STX}px,${STY}px) scale(${KS})}
.abs{position:absolute;left:0;top:0;transform-origin:50% 50%}
.sprite{overflow:hidden;border-radius:40px;background:#fff}
.sprite img{position:absolute;max-width:none}
.lift{box-shadow:0 40px 90px rgba(11,22,40,0.25),0 10px 24px rgba(11,22,40,0.12)}
.paper{background:#fff;border-radius:32px;font-family:'Inter';color:${C.text}}
.row{position:absolute;left:0;width:100%;height:118px;padding:18px 44px}
.row .d1{display:flex;justify-content:space-between;font-size:30px;font-weight:500}
.row .d1 .a{font-weight:600}
.row .d2{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:24px;color:${C.textSecondary}}
.chip{font-size:22px;font-weight:600;padding:6px 16px;border-radius:999px}
.chip.income{background:${C.greenLight};color:${C.green}}
.chip.counted{background:#E8ECF2;color:#3E4A5B}
.chip.not{background:#F1F2F4;color:${C.textSecondary}}
.doc{width:300px;height:380px;padding:28px}
.doc .mk{width:64px;height:64px;border-radius:14px;background:${C.green};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:24px}
.doc .ln{height:12px;border-radius:6px;background:#EEF0F2;margin-top:16px}
.pill{display:inline-flex;align-items:center;gap:16px;padding:22px 38px;border-radius:999px;background:${C.greenLight};color:${C.green};font-family:'Inter';font-weight:600;font-size:40px;white-space:nowrap}
.seg{position:absolute;top:0;height:120px;transform-origin:50% 100%}
.rate{position:absolute;font-family:'Inter';font-weight:600;font-size:30px;color:rgba(255,255,255,0.6);text-align:center}
#ball{position:absolute;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:20px;z-index:50;transform-origin:50% 50%}
${phoneCss(m)}
</style></head><body>

<!-- 1. Notifications, then the urgent alert -->
<div class="scene" id="sNotes" style="background:${C.green}">
  <div class="abs" id="wipe" style="left:0;top:0;width:${FW}px;height:${FH}px;background:${C.navy}"></div>
  <div class="stage" id="stNotes">
  <div class="abs" id="h1" style="left:0;top:170px;width:${W}px;text-align:center;font-family:'Playfair';font-weight:700;font-size:112px;color:#fff;line-height:1.05">${esc(X.moneyFrom[0])}<br><span style="color:${C.mint}">${esc(X.moneyFrom[1])}</span></div>
  <div class="abs" id="h2" style="left:0;top:230px;width:${W}px;text-align:center;font-family:'Playfair';font-weight:700;font-size:112px;color:#fff;line-height:1.05">${esc(X.taxSeason)}</div>
  <div class="abs" id="h3" style="left:0;top:170px;width:${W}px;text-align:center;font-family:'Playfair';font-weight:700;font-size:112px;color:#fff;line-height:1.05">${esc(X.question[0])}<br>${esc(X.question[1])} <span style="color:${C.mint}">${esc(X.question[2])}</span></div>
  <div id="notes"></div>
  </div>
</div>

<!-- 2. The real splash -->
<div class="scene" id="sSplash" style="background:${C.navy}"><div class="stage" id="stSplash"><img class="abs" id="splashImg" style="transform-origin:0 0;width:${W}px"></div></div>

<!-- 3. The canvas -->
<div class="scene" id="sWorld" style="background:${C.green}">
  <div class="stage" id="stWorld">
  <div class="abs" id="world" style="width:${W}px;height:${worldH}px;transform-origin:0 0">
    ${SECTIONS.map(([id, bg, h], i) => `<div class="abs" style="left:-3000px;top:${Y[id] - PAD_T - (i === 0 ? 3000 : 0)}px;width:${W + 6000}px;height:${h + PAD_T + PAD_B + (i === 0 || i === SECTIONS.length - 1 ? 3000 : 0)}px;background:${bg}"></div>`).join('')}
    <svg id="ribbon" class="abs" width="${W}" height="${worldH}" style="overflow:visible">
      <defs><mask id="rmask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="${W + 400}" height="${worldH + 400}"><path id="ribbonPath" fill="none" stroke="#fff" stroke-width="170" stroke-linecap="round"/></mask></defs>
      <g mask="url(#rmask)">
        <path id="rBand" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="150" stroke-linecap="round"/>
        <path id="rCore" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 26"/>
      </g>
      <circle id="rTipGlow" r="34" fill="${C.mint}" fill-opacity="0.25"/><circle id="rTip" r="11" fill="${C.mint}"/>
    </svg>

    <!-- up -->
    ${pf('upTitle', esc(X.upload), Y.up + 150, 120, '#fff')}
    <div class="abs" id="appPhone" style="left:${CX - m.width / 2}px;top:${Y.up + 400}px">${appPhone}</div>

    <!-- doc -->
    ${pf('docTitle', esc(X.reads), Y.doc + 150, 112, C.navy)}
    <div class="abs paper" id="paper" style="left:${CX - 420}px;top:${Y.doc + 360}px;width:840px;height:1060px">
      <div style="display:flex;align-items:center;gap:22px;padding:40px 44px 26px">
        <div style="width:72px;height:72px;border-radius:36px;background:${C.green};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:26px">${esc(script.statement.mark)}</div>
        <div><div style="font-size:34px;font-weight:600">${esc(script.statement.bank)}</div><div style="font-size:24px;color:${C.textSecondary};margin-top:4px">${esc(script.statement.period)}</div></div>
      </div>
      <div style="margin:0 44px;border-top:2px solid ${C.border}"></div>
      <div style="display:flex;justify-content:space-between;padding:20px 44px 6px;font-size:20px;letter-spacing:0.08em;color:${C.textSecondary};font-weight:600"><span>DESCRIPTION</span><span>CREDIT</span></div>
      <div style="position:absolute;left:0;top:250px;width:100%">
        ${STATEMENT.map(({ date: d, description: desc, amount: amt, kind, tag: label }, i) => `<div class="row" id="srow${i}" style="top:${i * 126}px"><div class="d1"><span>${desc}</span><span class="a">${amt}</span></div><div class="d2"><span>${d}</span><span class="chip ${kind}" id="chip${i}">${label}</span></div></div>`).join('')}
      </div>
    </div>
    <div class="abs" id="readCardWrap" style="left:${CX - 414}px;top:${Y.doc + 1160}px">${sprite('readCard', SPR.readCard, 0.4, 'border-radius:48px;position:relative')}</div>

    <!-- total -->
    ${script.statements.map(({ mark: mk, name, amount: amt }, i) => `<div class="abs paper doc" id="doc${i}" style="left:${CX - 470 + i * 320}px;top:${Y.total + 330}px"><div class="mk">${mk}</div><div style="font-size:23px;font-weight:600;margin-top:20px;line-height:1.2">${name}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:19px;color:${C.green}">${check(C.green, 22)}${esc(X.statementRead)}</div><div class="ln" style="width:92%"></div><div class="ln" style="width:70%"></div>
      <div style="position:absolute;left:28px;bottom:28px;font-size:34px;font-weight:600">${amt}</div></div>`).join('')}
    ${it('totalLabel', esc(X.totalIncome), Y.total + 960, 40, 'rgba(255,255,255,0.7)')}
    ${it('totalNum', '₦0', Y.total + 1020, 130, '#fff', 600)}

    <!-- home -->
    ${pf('oweTitle', esc(X.seeWhatYouOwe), Y.home + 220, 104, C.navy)}
    <div class="abs" id="homeCard" style="left:${CX - 415}px;top:${Y.home + 560}px;width:830px;height:582px;border-radius:48px;overflow:hidden"><img id="ringImg" style="position:absolute;left:${-48 * 0.401}px;top:${-36 * 0.401}px;width:${2166 * 0.401}px;max-width:none"></div>

    <!-- why -->
    <div class="abs" id="why" style="left:0;top:${Y.why + 820}px;width:${W}px;text-align:center;font-family:'Playfair';font-weight:700;font-size:210px;color:#fff;white-space:nowrap;line-height:1.05">${esc(X.andWhy[0])} <span style="color:${C.mint}">${esc(X.andWhy[1])}<span id="whyDot" style="color:transparent">${esc(X.andWhy[2])}</span></span></div>

    <!-- rows -->
    <div class="abs" id="calcWrap" style="left:${CX - 2070 * k / 2}px;top:${Y.rows + 330}px">${sprite('calc', SPR.calc, k, 'position:relative;border-radius:44px')}</div>

    <!-- bands -->
    ${it('bandLabel', esc(X.taxableIncome), Y.bands + 500, 40, 'rgba(255,255,255,0.7)')}
    <div class="abs" id="bar" style="left:${CX - 402}px;top:${Y.bands + 760}px;width:804px;height:120px"></div>
    <div class="abs" id="marker" style="left:0;top:${Y.bands + 730}px;width:4px;height:240px;background:#fff;border-radius:2px;transform-origin:50% 0"></div>
    <div class="abs" id="markerLabel" style="left:0;top:${Y.bands + 985}px;font-family:'Inter';font-size:32px;color:#fff;font-weight:600;white-space:nowrap">${esc(X.bandMarker)}</div>
    <div class="abs" id="sentence" style="left:${CX - 410}px;top:${Y.bands + 1110}px;width:820px;text-align:center;font-family:'Inter';font-size:50px;line-height:1.25;color:#fff;font-weight:600">${esc(X.bandSentence[0])} <span style="color:${C.mint}">${esc(X.bandSentence[1])}</span>${esc(X.bandSentence[2])}</div>
    ${it('average', esc(X.average), Y.bands + 1290, 40, 'rgba(255,255,255,0.7)')}

    <!-- number -->
    ${it('numLabel', esc(X.yourTax), Y.number + 690, 40, 'rgba(255,255,255,0.75)')}
    <div class="abs" id="numFig" style="left:0;top:${Y.number + 770}px;width:${W}px;text-align:center;font-family:'Playfair';font-weight:700;font-size:200px;color:#fff;line-height:1.05;white-space:nowrap">₦0</div>
    <div class="abs" id="numPill" style="left:0;top:${Y.number + 1060}px;width:${W}px;text-align:center"><span class="pill">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${C.green}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/></svg>
      ${esc(X.saved)}</span></div>

    <!-- close -->
    <img class="abs" id="closeO" src="${oMark}" style="left:${CX - 120}px;top:${Y.close + 980}px;width:1400px;height:1350px;transform-origin:50% 50%">
    <img class="abs" id="closeMark" src="${navyMark}" style="left:${CX - 290}px;top:${Y.close + 740}px;width:580px">
    ${it('tagline', esc(X.tagline), Y.close + 1000, 48, C.text, 600)}
    ${it('sub', esc(X.earlyTesting), Y.close + 1080, 34, C.textSecondary)}

    <div id="ball"></div>
  </div>
  </div>
</div>

<div class="abs" id="flash" style="left:0;top:0;width:${FW}px;height:${FH}px;background:#fff;opacity:0;pointer-events:none;z-index:60"></div>

<script>
const W=${W},H=${H},FH=${FH},CX=${CX},T=${JSON.stringify(T)},Y=${JSON.stringify(Y)},STATEMENT=${JSON.stringify(STATEMENT)},FIG=${JSON.stringify(FIG)},AL=${JSON.stringify(AL)},FPS=${fps};
const NOTIFS=${JSON.stringify(script.notifications)};
const M=${JSON.stringify(m)},K=${k},PAD_T=${PAD_T};
const SPLASH_DIR=${JSON.stringify(splashDir)}, RING_DIR=${JSON.stringify(ringDir)}, CAP=${JSON.stringify(cap)};
const bar0=document.getElementById('bar0');if(bar0){bar0.style.background='#FFFFFF';bar0.style.color='#111417'}
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const p=(t,a,b)=>clamp((t-a)/(b-a));
const eio=(x)=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const eio2=(x)=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
const eout=(x)=>1-Math.pow(1-x,3);
const eoutExpo=(x)=>x>=1?1:1-Math.pow(2,-10*x);
const ein=(x)=>x*x*x;
const lerp=(a,b,x)=>a+(b-a)*x;
const $=(id)=>document.getElementById(id);
const tf=(el,{x=0,y=0,s=1,sx=null,sy=null,o=1,b=0})=>{el.style.transform='translate('+x+'px,'+y+'px) scale('+(sx??s)+','+(sy??s)+')';el.style.opacity=o;el.style.filter=b>0.05?'blur('+b.toFixed(2)+'px)':'none'};
const show=(id,on)=>{$(id).style.display=on?'block':'none'};
const naira=(n)=>'₦'+Math.round(n).toLocaleString('en-NG');
// Calm entrance: fade + rise + unblur. Optional exit.
const rise=(el,t,t0,out0=99,out1=99,d=0.5)=>{const a=eout(p(t,t0,t0+d)),o=p(t,out0,out1);tf(el,{y:(1-a)*28-o*20,o:a*(1-o),b:(1-a)*6+o*6})};
const P=[246.9,464.3];
// key accents (the few real pops): a soft overshoot
const accent=(dt)=>dt<=0?0:1-Math.exp(-9*dt)*Math.cos(13*dt);

// ── Opening: notifications (max 5), the way they arrive on a phone ──
const NOTES=[...NOTIFS.map((n)=>[n.at,n.app,n.mark,n.color,n.title,n.body]),[AL.at,'','','','','']];
const GROUP=T.group, NW=920, NH=196, NGAP=22, ANCHOR=560, GA=780, AW=880, AH=600, AY=700, ALERT=AL.at, RED=AL.color;
const notesEl=$('notes');
const rings=[0,1,2].map(()=>{const r=document.createElement('div');r.className='abs';r.style.cssText+='border-radius:80px;border:5px solid '+RED+';opacity:0';notesEl.appendChild(r);return r});
const noteEls=NOTES.map((n,i)=>{const el=document.createElement('div');el.className='abs';
  el.style.cssText+='left:'+(CX-NW/2)+'px;top:0;width:'+NW+'px;height:'+NH+'px;border-radius:44px;background:rgba(255,255,255,0.96);display:flex;align-items:center;gap:28px;padding:0 34px;font-family:Inter;color:${C.text};transform-origin:50% 0;box-shadow:0 30px 60px rgba(11,22,40,0.18)';
  el.innerHTML='<div style="width:96px;height:96px;border-radius:24px;background:'+n[3]+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:'+(n[2].length>1?32:44)+'px;flex:none">'+n[2]+'</div>'+
    '<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;font-size:26px;color:${C.textSecondary};font-weight:500"><span>'+n[1]+'</span><span>now</span></div>'+
    '<div style="font-size:34px;font-weight:600;margin-top:6px">'+n[4]+'</div><div style="font-size:32px;font-weight:500;margin-top:2px;white-space:nowrap">'+n[5]+'</div></div>';
  if(i===4){ // the tax reminder: an urgent alert, on its own
    el.style.left=(CX-AW/2)+'px';el.style.width=AW+'px';el.style.height=AH+'px';el.style.borderRadius='56px';el.style.flexDirection='column';el.style.justifyContent='center';el.style.gap='0';el.style.padding='0 56px';el.style.textAlign='center';el.style.background=RED;el.style.color='#fff';el.style.transformOrigin='50% 50%';el.style.boxShadow='0 40px 90px rgba(217,48,37,0.35)';
    const tile=(id,lab)=>'<div style="width:150px;padding:16px 0 12px;border-radius:24px;background:rgba(255,255,255,0.16)"><div id="'+id+'" style="font-size:64px;font-weight:600;letter-spacing:-0.02em;font-variant-numeric:tabular-nums">00</div><div style="font-size:20px;letter-spacing:0.12em;opacity:0.8;margin-top:2px">'+lab+'</div></div>';
    el.innerHTML='<div><div style="display:flex;align-items:center;justify-content:center;gap:14px;font-size:24px;font-weight:600;letter-spacing:0.14em;opacity:0.92">'+
      '<svg id="warnIcon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'+AL.label+'</div>'+
      '<div style="font-size:66px;font-weight:600;margin-top:22px;letter-spacing:-0.015em">'+AL.title+'</div></div>'+
      '<div><div style="display:flex;justify-content:center;gap:18px;margin-top:30px">'+tile('cdD','DAYS')+tile('cdH','HRS')+tile('cdM','MIN')+tile('cdS','SEC')+'</div>'+
      '<div style="font-size:30px;font-weight:500;margin-top:24px;opacity:0.9">'+AL.due+'</div></div>'}
  notesEl.appendChild(el);return el});
const hex=(c)=>[1,3,5].map((i)=>parseInt(c.slice(i,i+2),16));
const mix=(c1,c2,u)=>{const a=hex(c1),b=hex(c2);return 'rgb('+a.map((v,i)=>Math.round(lerp(v,b[i],u))).join(',')+')'};
// a soft iOS-like settle
const settle=(dt)=>dt<=0?0:1-Math.exp(-11*dt)*Math.cos(12*dt);

// ── The world: sections, ribbon, camera ──
const world=$('world');
// The ribbon: a thick, faint curve that weaves down the canvas and draws itself ahead of the camera.
const RP=[[CX,Y.up+1500]];{const ids=['doc','total','home','why','rows','bands','number','close'];ids.forEach((id,i)=>RP.push([i%2?880:200,Y[id]+(id==='rows'?1300:960)]))}
{let d='M'+RP[0][0]+','+RP[0][1];for(let i=1;i<RP.length;i++){const [x0,y0]=RP[i-1],[x1,y1]=RP[i];const dy=(y1-y0)*0.5;d+=' C'+x0+','+(y0+dy)+' '+x1+','+(y1-dy)+' '+x1+','+y1}['ribbonPath','rBand','rCore'].forEach((id)=>$(id).setAttribute('d',d));}
const RPATH=$('ribbonPath');const RLEN=RPATH.getTotalLength();const RSAMP=[];for(let l=0;l<=RLEN;l+=40)RSAMP.push([l,RPATH.getPointAtLength(l).y]);
RPATH.style.strokeDasharray=RLEN;
function drawRibbon(camY,t){const target=camY+620;let L=0;for(const [l,y] of RSAMP){if(y<=target)L=l;else break}RPATH.style.strokeDashoffset=RLEN-L;
  $('rCore').style.strokeDashoffset=-t*90;const q=RPATH.getPointAtLength(L);['rTip','rTipGlow'].forEach((id)=>{$(id).setAttribute('cx',q.x);$(id).setAttribute('cy',q.y)});
  $('ribbon').style.opacity=1-p(t,T.closeLand-0.35,T.closeLand+0.4);
  const pulse=(t*1.6)%1;$('rTipGlow').setAttribute('r',18+30*pulse);$('rTipGlow').setAttribute('fill-opacity',0.35*(1-pulse))}
// camera: world point (wx,wy) at screen centre, scale s
const screenCenterUp=[CX,Y.up+400+M.height/2];
function camAt(t,ballY){
  const sec=(id,dy=0)=>[CX,Y[id]+960+dy,1];
  let c;
  if(t<T.glides.doc[0]){const z=eio(p(t,T.drop,T.drop+0.8));c=[CX,lerp(screenCenterUp[1],Y.up+960,z),lerp(1.85,1,z)]}
  else{
    const G=[['doc',T.glides.doc],['total',T.glides.total],['home',T.glides.home],['why',T.glides.why],['rows',T.glides.rows],['bands',T.glides.bands],['number',T.glides.number],['close',T.glides.close]];
    let prev=sec('up');
    for(const [id,[a,b]] of G){const target=sec(id);
      if(t<a){c=prev;break}
      if(t<b){const e=eio(p(t,a,b));c=[CX,lerp(prev[1],target[1],e),1];break}
      prev=target;
      if(id==='rows'){const by=t>=T.glides.bands[0]?MARK[5]:(ballY??MARK[0]);const sc=clamp(by-(Y.rows+960)+80,0,760);prev=[CX,target[1]+sc,1]}
      c=prev}
  }
  return c;
}
function applyCam(c){const [wx,wy,s]=c;world.style.transform='translate('+(CX-wx*s)+'px,'+(960-wy*s)+'px) scale('+s+')'}

// ── The ball: a path of world points; glides (eased) with a gentle arc, squash only where marked ──
const ballEl=$('ball');
function placeBall(x,y,col,{r=20,o=1,sq=0}={}){ballEl.style.opacity=o;ballEl.style.background=col;ballEl.style.width=ballEl.style.height=(2*r)+'px';ballEl.style.margin=(-r)+'px 0 0 '+(-r)+'px';ballEl.style.borderRadius=r+'px';
  ballEl.style.transform='translate('+x+'px,'+y+'px) scale('+(1+0.2*sq)+','+(1-0.2*sq)+')'}
function along(t,path){ // path: [{t,x,y,arc?,land?}]
  if(t<path[0].t) return null;
  for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1];if(t>=a.t&&t<b.t){const u=eio(p(t,a.t,b.t));const arc=b.arc||0;
      return {x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u)-4*arc*u*(1-u),sq:0}}}
  const L=path[path.length-1];const since=t-L.t;return {x:L.x,y:L.y,sq:L.land&&since<0.12?Math.sin(since/0.12*Math.PI):0};
}
function squashAt(t,lands){for(const l of lands){const d=t-l;if(d>=0&&d<0.12)return Math.sin(d/0.12*Math.PI)}return 0}

// Geometry for the ball's stops
const phoneCard=[CX-M.width/2+M.bezel+300*M.k,Y.up+400+M.bezel+(59+318)*M.k];
const chipY=(i)=>Y.doc+360+250+i*126+70;
const CHIPX=CX+420-44-80;
const RING=[CX-415+(1841-48)*0.401,Y.home+560+(182-36)*0.401-22];
let WHYDOT=[CX,Y.why+1000];
const MARK=[[2570],[2802],[3278],[4227],[4581],[5287]].map(([y])=>Y.rows+330+(y-2227)*K);
const MARKX=CX-2070*K/2+(308-144)*K;
const BANDS=FIG.bands;
const segX=[];{let x=0;BANDS.forEach(([v])=>{const w=804*v/FIG.taxableIncome;segX.push([x,w]);x+=w})}
const BX=CX-402;
const barEl=$('bar');BANDS.forEach(([v,r],i)=>{const [x,w]=segX[i];const s=document.createElement('div');s.className='seg';s.style.left=x+'px';s.style.width=(w-4)+'px';
  s.style.background=i===5?'${C.mint}':'rgba(95,199,155,'+(0.16+0.12*i)+')';s.style.borderRadius=(i===0?'24px 0 0 24px':i===5?'0 24px 24px 0':'0');barEl.appendChild(s);
  const l=document.createElement('div');l.className='rate';l.textContent=r+'%';l.style.left=(x+w/2-50)+'px';l.style.width='100px';l.style.top='-58px';if(i===5){l.style.color='${C.mint}';l.style.fontSize='40px';l.style.top='-70px'}barEl.appendChild(l)});
const segs=[...barEl.querySelectorAll('.seg')],rates=[...barEl.querySelectorAll('.rate')];
const MX=BX+804*FIG.topBandFrom/FIG.taxableIncome-2;

let measured=false;
function measure(){ // positions that depend on rendered text
  if(measured)return;measured=true;
  const prev=world.style.transform,prevSt=$('stWorld').style.transform;world.style.transform='none';$('stWorld').style.transform='none';$('sWorld').style.display='block';
  const r=$('whyDot').getBoundingClientRect();WHYDOT=[r.left+r.width/2,r.top+r.height*0.8-20];
  const fr=document.createRange();$('numFig').textContent=naira(FIG.taxDue);fr.selectNodeContents($('numFig'));const nr=fr.getBoundingClientRect();NUMR=[nr.right+34,nr.top+nr.height*0.32];
  $('sWorld').style.display='none';world.style.transform=prev;$('stWorld').style.transform=prevSt;
}
let NUMR=[CX+400,Y.number+840];

window.frameSources=(t)=>{const out={};
  if(t>=T.splash&&t<T.drop) out.splashImg=SPLASH_DIR+'/'+String(Math.min(Math.round(3.1*FPS),Math.floor((t-T.splash)*FPS+1e-6))).padStart(3,'0')+'.png';
  if(t>=T.drop&&t<T.glides.doc[1]) out.img0=CAP+'/reading/spin-'+String(Math.floor((t-T.drop)/0.08)%12).padStart(2,'0')+'.png';
  if(t>=T.glides.home[0]-0.5&&t<T.glides.why[1]) out.ringImg=RING_DIR+'/'+String(clamp(Math.floor((t-T.ringLand)*FPS),0,Math.round(1.4*FPS)-1)).padStart(3,'0')+'.png';
  return out};

window.renderAt=(t)=>{
  measure();
  const inNotes=t<T.splash,inSplash=t>=T.splash&&t<T.drop,inWorld=t>=T.drop;
  show('sNotes',inNotes);show('sSplash',inSplash);show('sWorld',inWorld);$('flash').style.opacity=0;ballEl.style.opacity=0;

  // ── 1. Notifications ──
  if(inNotes){
    // navy wipes up over the green when tax season arrives
    const wp=eio(p(t,GROUP,GROUP+0.45));tf($('wipe'),{y:(1-wp)*FH});
    rise($('h1'),t,T.moneyFrom,GROUP-0.1,GROUP+0.1);rise($('h2'),t,T.season,T.seasonOut[0],T.seasonOut[1]);rise($('h3'),t,T.question,T.questionOut[0],T.questionOut[1]);
    const grp=eio(p(t,GROUP,GROUP+0.5));const morph=eio(p(t,T.gather[0],T.gather[1]-0.05));
    NOTES.forEach((n,i)=>{const el=noteEls[i];const dt=t-n[0];if(dt<0){el.style.opacity=0;return}
      const a=settle(dt);
      // newest on top: each later arrival pushes this one down one slot (until they group)
      let slots=0;NOTES.forEach((m2,j)=>{if(j>i&&j<4)slots+=eout(p(t,m2[0],m2[0]+0.35))});
      const isRem=i===4;
      let y=isRem?AY:ANCHOR+slots*(NH+NGAP)-(1-a)*140,s=isRem?1.18-0.18*clamp(1-Math.exp(-14*dt)*Math.cos(10*dt),0,1.2):0.9+0.1*a,o=clamp(dt/(isRem?0.05:0.12));
      if(!isRem&&grp>0){ // group into a stack: oldest furthest back
        const depth=3-i;const gy=GA+depth*28,gs=1-depth*0.05;
        const gone=eio(p(t,GROUP+0.45,ALERT-0.05));y=lerp(y,gy,grp)+gone*260;s=lerp(s,gs,grp)*(1-0.15*gone);o*=lerp(1,depth>2?0:1-depth*0.25,grp)*(1-gone)}
      el.style.zIndex=isRem?10:(5-(3-i));
      if(isRem&&t>=ALERT){const dt2=t-ALERT;
        // countdown: two days and change, running down fast
        const left=Math.max(0,AL.countdownStartSeconds-dt2*AL.countdownSpeed);const D=Math.floor(left/86400),Hh=Math.floor(left%86400/3600),Mm=Math.floor(left%3600/60),Ss=Math.floor(left%60);
        [['cdD',D],['cdH',Hh],['cdM',Mm],['cdS',Ss]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=String(v).padStart(2,'0')});
        const wi=document.getElementById('warnIcon');if(wi)wi.style.transform='rotate('+(Math.sin(dt2*38)*10*(dt2%1<0.4?1:0.15))+'deg)';
        const sh=Math.exp(-dt2*7);const sx=Math.sin(dt2*70)*16*sh,sy=Math.cos(dt2*53)*8*sh;el.style.marginLeft=sx+'px';el.style.marginTop=sy+'px';$('h2').style.marginLeft=sx*0.5+'px';
        rings.forEach((r,k)=>{const ph=((dt2*0.9)+k/3)%1;const g2=morph>0?1-clamp(morph*3):1;r.style.left=(CX-AW/2-ph*120)+'px';r.style.top=(AY-ph*120)+'px';r.style.width=(AW+ph*240)+'px';r.style.height=(AH+ph*240)+'px';r.style.opacity=0.55*(1-ph)*g2;r.style.borderRadius=(56+ph*60)+'px'});
        // the text clears just before the card shrinks
        const fade=1-p(t,T.alertTextOut[0],T.alertTextOut[1]);el.firstChild.style.opacity=fade;el.lastChild.style.opacity=fade}
      if(isRem)el.style.overflow='hidden';
      if(isRem&&morph>0){ // the alert becomes the ball
        const size=lerp(AW,40,morph),hh=lerp(AH,40,morph);const cx=CX,cy=lerp(AY+AH/2,960,morph);
        el.style.left=(cx-size/2)+'px';el.style.width=size+'px';el.style.height=hh+'px';el.style.borderRadius=lerp(56,20,morph)+'px';
        el.style.background=mix(RED,'${C.ball}',clamp((morph-0.72)/0.2));
        el.style.boxShadow='none';y=cy-hh/2;s=1}
      if(!isRem&&morph>0)o*=1-clamp(morph*2);
      el.style.top=y+'px';el.style.opacity=o;el.style.transform='scale('+s+')'});
    // the ball glides to where the splash's ball begins
    if(t>=T.gather[1]-0.05){const el=noteEls[4];el.style.opacity=0;const u=eio(p(t,T.gather[1]-0.05,T.splash));$('stNotes').appendChild(ballEl);
      placeBall(lerp(CX,P[0],u),lerp(960,P[1]+20,u)-4*120*u*(1-u),'${C.ball}')}
  }
  // ── 2. Splash ──
  if(inSplash){tf($('splashImg'),{s:1});$('stSplash').appendChild(ballEl);placeBall(P[0],P[1]+20,'${C.ball}',{o:1-p(t,T.splash+0.17,T.splash+0.24)})}
  // ── 3. The canvas ──
  if(inWorld){
    world.appendChild(ballEl);
    $('flash').style.opacity=1-p(t,T.drop,T.drop+0.25);
    // up
    rise($('upTitle'),t,T.upload);
    // doc
    rise($('docTitle'),t,T.docTitle);
    STATEMENT.forEach((r,i)=>{const at=lerp(T.roll[0],T.roll[1],(i+0.5)/STATEMENT.length);const a=eout(p(t,at,at+0.3));const chip=$('chip'+i),row=$('srow'+i);
      chip.style.opacity=a;chip.style.transform='translateX('+(1-a)*16+'px)';
      row.style.background=r[3]==='income'&&a>0?'rgba(227,243,236,'+a+')':'transparent';
      row.style.color=r[3]!=='income'&&a>0?'${C.textSecondary}':'';row.querySelector('.a').style.textDecoration=r[3]!=='income'&&a>0.5?'line-through':'none'});
    {const dt=t-T.readCard;const rc=$('readCardWrap');const s=accent(dt);tf(rc,{y:dt<0?40:(1-s)*60,s:dt<0?0.9:0.92+0.08*s,o:dt<0?0:clamp(dt/0.12)});$('readCard').classList.add('lift')}
    // total
    [0,1,2].forEach((i)=>rise($('doc'+i),t,T.docs+i*0.15));
    rise($('totalLabel'),t,T.docs+0.5);
    {const k2=eoutExpo(p(t,T.docs+0.5,T.totalLand));$('totalNum').textContent=naira(FIG.totalIncome*k2);const land=t-T.totalLand;
      tf($('totalNum'),{y:(1-eout(p(t,T.docs+0.5,T.docs+1)))*28,o:eout(p(t,T.docs+0.5,T.docs+0.9)),s:land>0?1+0.06*Math.exp(-9*land)*Math.cos(13*land):1})}
    // home
    rise($('oweTitle'),t,T.glides.home[1]-0.1);
    tf($('homeCard'),{y:(1-eout(p(t,T.glides.home[0]+0.3,T.glides.home[1]+0.3)))*60,o:eout(p(t,T.glides.home[0]+0.3,T.glides.home[1]+0.2))});
    // why
    rise($('why'),t,T.whyTitle);
    // rows: revealed down to just below the ball
    // bands
    rise($('bandLabel'),t,T.bandsLabel);
    const rollU=eio2(p(t,T.barRoll[0],T.barRoll[1]));const ballBX=BX+804*rollU;
    segs.forEach((sg,i)=>{const [x,w]=segX[i];const u=clamp((ballBX-(BX+x))/Math.max(w,40)*1.6);sg.style.transform='scaleY('+eout(u)+')';sg.style.opacity=u>0?1:0});
    rates.forEach((r,i)=>{const [x,w]=segX[i];const u=clamp((ballBX-(BX+x+w*0.4))/40);r.style.opacity=u;r.style.transform='translateY('+(1-u)*10+'px)'});
    {const md=t-T.marker;tf($('marker'),{x:MX,sy:eout(clamp(md/0.4)),o:md<0?0:1});$('marker').style.transformOrigin='50% 0';
      const ml=eout(p(t,T.marker+0.15,T.marker+0.5));tf($('markerLabel'),{x:MX-110,y:(1-ml)*14,o:ml})}
    rise($('sentence'),t,T.sentence);rise($('average'),t,T.average);
    // number
    rise($('numLabel'),t,T.number-0.2);
    {const k3=eoutExpo(p(t,T.number,T.numberLand));$('numFig').textContent=naira(FIG.taxDue*k3);const land=t-T.numberLand;
      tf($('numFig'),{o:eout(p(t,T.number,T.number+0.3)),s:land>0?1+0.06*Math.exp(-9*land)*Math.cos(13*land):1,b:(1-eout(p(t,T.number,T.number+0.4)))*8})}
    {const dt=t-T.pill;const s=accent(dt);tf($('numPill'),{y:dt<0?0:(1-s)*24,s:dt<0?0.8:0.85+0.15*s,o:dt<0?0:clamp(dt/0.1)})}
    // close
    {const m2=t-T.closeLand;const s=accent(m2);tf($('closeMark'),{s:m2<0?0.9:0.9+0.1*s,o:m2<0?0:clamp(m2/0.12)})}
    {const o2=eio(p(t,T.glides.close[0]+0.2,T.closeLand+1.6));tf($('closeO'),{s:1.1-0.1*o2,o:0.065*o2});$('closeO').style.transform+=' rotate('+(-8+8*o2)+'deg)'}
    rise($('tagline'),t,T.tagline);rise($('sub'),t,T.sub);

    // rows reveal: everything above the ball (+ a soft edge)
    const mk=(y)=>{const top=Y.rows+330;const local=clamp((y+70-top)/(3270*K),0,1)*100;const v='linear-gradient(to bottom,#000 '+(local-3)+'%,transparent '+(local+1)+'%)';$('calc').style.webkitMaskImage=v;$('calc').style.maskImage=v};

    // ── The ball's journey (world coords) ──
    const G=T.glides;
    const path=[
      {t:T.cardLand-0.6,x:CX+300,y:Y.up+240},{t:T.cardLand,x:phoneCard[0],y:phoneCard[1],arc:60,land:1},
      {t:G.doc[0],x:phoneCard[0],y:phoneCard[1]},{t:G.doc[0]+0.25,x:CX,y:Y.up+1660},{t:G.doc[1]+0.1,x:CX,y:Y.doc+330},
      {t:T.roll[0],x:CHIPX,y:chipY(0)-50,arc:40},{t:T.roll[1],x:CHIPX,y:chipY(5)},
      {t:G.total[0],x:CHIPX,y:chipY(5)},{t:G.total[0]+0.3,x:CX,y:Y.doc+1460},{t:G.total[1],x:CX,y:Y.total+300},
      {t:T.docs+0.4,x:CX,y:Y.total+300},{t:T.docs+0.9,x:CX,y:Y.total+900,arc:30},
      {t:G.home[0],x:CX,y:Y.total+900},{t:G.home[1],x:CX,y:Y.home+180},{t:T.ringLand,x:RING[0],y:RING[1],arc:80,land:1},
      {t:G.why[0],x:RING[0],y:RING[1]},{t:G.why[0]+0.2,x:CX,y:Y.home+1200},{t:G.why[1],x:CX,y:Y.why+700},{t:T.whyDot,x:WHYDOT[0],y:WHYDOT[1],arc:60,land:1},
      {t:G.rows[0],x:WHYDOT[0],y:WHYDOT[1]},{t:G.rows[0]+0.2,x:CX,y:Y.why+1120},{t:G.rows[1],x:CX,y:Y.rows+280},{t:T.rowsScroll[0],x:MARKX,y:MARK[0],arc:40},
      ...MARK.slice(1).map((y,i)=>({t:lerp(T.rowsScroll[0],T.rowsScroll[1],(i+1)/(MARK.length-1)),x:MARKX,y})),
      {t:G.bands[0],x:MARKX,y:MARK[5]},{t:G.bands[0]+0.3,x:CX,y:Y.rows+330+3270*K+40},{t:G.bands[1],x:CX,y:Y.bands+460},
      {t:T.barRoll[0],x:BX,y:Y.bands+760-22,arc:60},{t:T.barRoll[1],x:BX+804,y:Y.bands+760-22},{t:T.marker,x:MX,y:Y.bands+760-22,arc:50,land:1},
      {t:G.number[0],x:MX,y:Y.bands+760-22},{t:G.number[0]+0.25,x:CX,y:Y.bands+1380},{t:G.number[1],x:CX,y:Y.number+640},{t:T.numberLand,x:NUMR[0],y:NUMR[1],arc:60,land:1},
      {t:G.close[0],x:NUMR[0],y:NUMR[1]},{t:G.close[0]+0.25,x:CX,y:Y.number+1180},{t:G.close[1],x:CX,y:Y.close+660},{t:T.closeLand,x:CX+290-60,y:Y.close+752,arc:50,land:1},
    ];
    const st=along(t,path);
    const cam=camAt(t,st?st.y:null);applyCam(cam);drawRibbon(cam[1],t);
    if(st){
      // the ball sits on the bar while it rolls
      const sq=squashAt(t,[T.cardLand,T.ringLand,T.whyDot,T.marker,T.numberLand,T.closeLand,...MARK.slice(1).map((y,i)=>lerp(T.rowsScroll[0],T.rowsScroll[1],(i+1)/(MARK.length-1)))]);
      const section=Object.entries(Y).filter(([id,y])=>st.y>=y-PAD_T).pop()[0];
      const col={up:'#fff',doc:'${C.navy}',total:'${C.mint}',home:'${C.navy}',why:'${C.mint}',rows:'${C.ball}',bands:'${C.mint}',number:'#fff',close:'${C.ball}'}[section];
      const o=(t<T.cardLand-0.6?0:clamp((t-(T.cardLand-0.6))/0.15))*(1-p(t,T.closeLand+0.15,T.closeLand+0.3));
      placeBall(st.x,st.y,col,{sq,o});
      if(t>=G.rows[0]&&t<G.bands[1])mk(st.y);
    }
    if(t<G.rows[0])mk(Y.rows+250);
  }
};
</script></body></html>`;
}
