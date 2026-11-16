/**
 * Colour lab: try other palettes on the live UI.
 *
 * Open it with ?lab in the URL (it stays open until you close it). Pick a
 * preset, or drag on the wheels: the accent wheel sets the hue and strength of
 * every gold in the UI (canvases included), the background wheel sets the
 * tint of the near-black. Choices persist in this browser; Reset clears them.
 *
 * How: every gold in ORION is one hue, and greys stay grey under CSS
 * hue-rotate/saturate. So one filter on the page's layers (not the background)
 * recolours all of it, and the background is set on its own, exactly.
 */

const KEY = 'orion-lab';
const OPEN_KEY = 'orion-lab-open';
const BASE = [214, 180, 106];          // ORION's gold, #d6b46a: what the filter starts from

const PRESETS = [
  { name: 'Gold', note: 'as built', a: { h: 41.5, s: 0.57, b: 1 }, bg: { h: 240, s: 0.05, l: 0.045 } },
  { name: 'Champagne', note: 'graphite', a: { h: 38, s: 0.32, b: 1.06 }, bg: { h: 30, s: 0.07, l: 0.05 } },
  { name: 'Platinum', note: 'cool black', a: { h: 220, s: 0.06, b: 1.08 }, bg: { h: 220, s: 0.1, l: 0.05 } },
  { name: 'Bronze', note: 'espresso', a: { h: 28, s: 0.5, b: 0.9 }, bg: { h: 24, s: 0.2, l: 0.055 } },
  { name: 'Rose gold', note: 'plum black', a: { h: 14, s: 0.4, b: 1.02 }, bg: { h: 345, s: 0.09, l: 0.05 } },
  { name: 'Brass', note: 'olive', a: { h: 48, s: 0.45, b: 0.94 }, bg: { h: 75, s: 0.12, l: 0.05 } },
  { name: 'Ivory', note: 'midnight', a: { h: 40, s: 0.24, b: 1.12 }, bg: { h: 225, s: 0.28, l: 0.065 } },
  { name: 'Mono', note: 'pure black', a: { h: 0, s: 0, b: 1.15 }, bg: { h: 0, s: 0, l: 0 } },
  // purple and champagne: champagne light in a violet dark
  { name: 'Aubergine', note: 'champagne', a: { h: 38, s: 0.34, b: 1.06 }, bg: { h: 280, s: 0.3, l: 0.045, g: 0.55 } },
  { name: 'Amethyst', note: 'champagne', a: { h: 36, s: 0.4, b: 1.08 }, bg: { h: 268, s: 0.38, l: 0.06, g: 0.9 } },
  { name: 'Plum', note: 'pale gold', a: { h: 42, s: 0.28, b: 1.12 }, bg: { h: 300, s: 0.22, l: 0.04, g: 0.4 } },
  { name: 'Velvet', note: 'champagne', a: { h: 34, s: 0.3, b: 1.02 }, bg: { h: 258, s: 0.45, l: 0.03, g: 1 } },
];
// the background: a flat colour, or with `g` a soft glow of the same hue behind the centre
function bgCss({ h, s, l, g = 0 }) {
  const flat = hex(hsl2rgb(h, s, l));
  if (!g) return flat;
  const mid = hex(hsl2rgb(h, Math.min(0.75, s + 0.25 * g), l + 0.07 * g));
  const edge = hex(hsl2rgb(h, s, l * 0.7));
  return `radial-gradient(75% 60% at 50% 42%, ${mid} 0%, ${flat} 55%, ${edge} 100%)`;
}

/* ---------- colour maths ---------- */

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function hsl2rgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const hex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

// the CSS filter functions as matrices (Filter Effects spec)
function hueM(deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}
function satM(s) {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
}
const mul = (A, B) => Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
});
const apply = (M, [r, g, b]) => [M[0] * r + M[1] * g + M[2] * b, M[3] * r + M[4] * g + M[5] * b, M[6] * r + M[7] * g + M[8] * b];
function inv(M) {
  const [a, b, c, d, e, f, g, h, i] = M;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
}

/** The filter that turns ORION's gold into the accent {h, s, b}, and the colour it renders. */
function solve({ h, s, b }) {
  let best = 0, err = 1e9;
  for (let d = 0; d < 360; d += 1) {                    // hue-rotate isn't an exact HSL rotation: search for it
    const [hh, ss] = rgb2hsl(apply(hueM(d), BASE));
    const e = Math.min(Math.abs(hh - h), 360 - Math.abs(hh - h));
    if (ss > 0.05 && e < err) { err = e; best = d; }
  }
  const rotated = rgb2hsl(apply(hueM(best), BASE));
  const sat = clamp(s / Math.max(0.05, rotated[1]), 0, 3);
  const M = mul(satM(sat), hueM(best)).map((v) => v * b);
  return { css: `hue-rotate(${best}deg) saturate(${sat.toFixed(3)}) brightness(${b.toFixed(3)})`, M, rgb: apply(M, BASE).map((v) => clamp(v, 0, 255)) };
}

/* ---------- state ---------- */

let state = load() ?? structuredClone(PRESETS[0]);
function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

function applyTheme() {
  const root = document.documentElement;
  const f = solve(state.a);
  const bg = hsl2rgb(state.bg.h, state.bg.s, state.bg.l);
  // layers inside the filter that paint the background colour need it pre-compensated, so it lands exact
  const pre = apply(inv(f.M.map((v, i) => v + (i % 4 === 0 ? 1e-4 : 0))), bg).map((v) => clamp(v, 0, 255));
  root.style.setProperty('--lab-filter', f.css);
  root.style.setProperty('--lab-bg', bgCss(state.bg));
  root.style.setProperty('--bg0', hex(pre));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex(bg));
  return { accent: hex(f.rgb), bg: hex(bg) };
}

/* ---------- the panel ---------- */

const STYLE = `
:root.lab-on body > :not(.bg):not(.lab):not(script) { filter: var(--lab-filter); }
:root.lab-on .bg { background: var(--lab-bg) !important; }
.lab { position: fixed; z-index: 90; right: 16px; bottom: 16px; width: 312px; max-height: calc(100svh - 32px); overflow-y: auto;
  padding: 14px 16px 16px; border-radius: 16px; background: #111; border: 1px solid rgba(255,255,255,.1); color: #eee;
  font: 400 12px/1.4 var(--font); scrollbar-width: none; box-shadow: 0 20px 50px rgba(0,0,0,.5); }
.lab[hidden] { display: none; }
.lab h3 { margin: 0; font-size: 13px; font-weight: 500; }
.lab-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.lab-x { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #aaa; }
.lab-x:hover { background: rgba(255,255,255,.08); color: #fff; }
.lab-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px; }
.lab-p { display: grid; gap: 5px; justify-items: center; padding: 6px 2px 5px; border-radius: 10px; border: 1px solid transparent; color: #bbb; font-size: 10.5px; }
.lab-p:hover { background: rgba(255,255,255,.05); }
.lab-p[aria-pressed="true"] { border-color: rgba(255,255,255,.28); color: #fff; }
.lab-p i { position: relative; width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(255,255,255,.14); }
.lab-p i::after { content: ""; position: absolute; inset: 11px; border-radius: 50%; background: var(--c); }
.lab-wheels { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.lab-w { display: grid; gap: 8px; }
.lab-w > span { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 6px; color: #999; }
.lab-w > span b { font: 500 11px var(--mono); color: #eee; display: inline-flex; gap: 6px; align-items: center; }
.lab-w > span b::before { content: ""; width: 10px; height: 10px; border-radius: 3px; background: var(--c); border: 1px solid rgba(255,255,255,.2); }
.lab-wheel { position: relative; aspect-ratio: 1; touch-action: none; cursor: crosshair; }
.lab-wheel canvas { width: 100%; height: 100%; border-radius: 50%; display: block; }
.lab-wheel i { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.6); pointer-events: none; }
.lab-w label { display: grid; gap: 4px; color: #999; }
.lab-w input { width: 100%; accent-color: #ddd; }
.lab-foot { display: flex; gap: 8px; margin-top: 14px; }
.lab-foot button { flex: 1; height: 32px; border-radius: 9px; border: 1px solid rgba(255,255,255,.14); color: #ddd; font-size: 12px; }
.lab-foot button:hover { background: rgba(255,255,255,.06); }
.lab-foot button.primary { background: #eee; color: #111; border-color: transparent; }
.lab-fab { position: fixed; z-index: 90; right: 16px; bottom: 16px; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(from 0deg, #d6b46a, #d9c3a0, #c9ccd1, #b8865b, #d4a59a, #b9a46a, #d6b46a); border: 2px solid #111; box-shadow: 0 0 0 1px rgba(255,255,255,.2); }
@media (max-width: 899px) {
  .lab { left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 58svh; }
  .lab-fab { bottom: auto; top: calc(env(safe-area-inset-top, 0px) + 64px); right: 12px; width: 32px; height: 32px; }
}`;

/** Draw a hue × saturation disc: hue round the rim, saturation out from the centre (up to maxS). */
function paintWheel(cv, l, maxS) {
  const n = 220; cv.width = cv.height = n;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(n, n), r0 = n / 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x - r0 + 0.5, dy = y - r0 + 0.5, r = Math.hypot(dx, dy) / r0;
    const i = (y * n + x) * 4;
    if (r > 1) { img.data[i + 3] = 0; continue; }
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360;
    const [R, G, B] = hsl2rgb(h, r * maxS, l);
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function wheel(host, { l, maxS, get, set }) {
  const cv = document.createElement('canvas'), dot = document.createElement('i');
  host.append(cv, dot);
  paintWheel(cv, l, maxS);
  const place = () => {
    const { h, s } = get();
    const r = clamp(s / maxS) * 50, a = ((h - 90) * Math.PI) / 180;
    dot.style.left = `${50 + Math.cos(a) * r}%`; dot.style.top = `${50 + Math.sin(a) * r}%`;
  };
  const pick = (e) => {
    const b = host.getBoundingClientRect();
    const dx = e.clientX - b.left - b.width / 2, dy = e.clientY - b.top - b.height / 2;
    const r = clamp(Math.hypot(dx, dy) / (b.width / 2));
    set({ h: ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360, s: r * maxS });
    place();
  };
  host.addEventListener('pointerdown', (e) => { host.setPointerCapture(e.pointerId); pick(e); });
  host.addEventListener('pointermove', (e) => { if (host.hasPointerCapture(e.pointerId)) pick(e); });
  return place;
}

export function mountLab() {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const touched = !!load();
  if (touched) document.documentElement.classList.add('lab-on');
  if (touched) applyTheme();
  const wanted = new URLSearchParams(location.search).has('lab');
  let open = wanted || (() => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } })();
  if (!open && !touched) return;

  const panel = document.createElement('section');
  panel.className = 'lab';
  panel.setAttribute('aria-label', 'Colour lab');
  panel.innerHTML = `
    <div class="lab-head"><h3>Colour</h3><button class="lab-x" aria-label="Hide colour lab">✕</button></div>
    <div class="lab-presets">${PRESETS.map((p, i) => {
      const c = hex(solve(p.a).rgb);
      return `<button class="lab-p" data-i="${i}" title="${p.name}, ${p.note}"><i style="background:${bgCss(p.bg)};--c:${c}"></i>${p.name}</button>`;
    }).join('')}</div>
    <div class="lab-wheels">
      <div class="lab-w"><span>Accent <b id="lab-a"></b></span><div class="lab-wheel" id="lab-wa"></div>
        <label>Brightness<input type="range" id="lab-ab" min="0.7" max="1.3" step="0.01"></label></div>
      <div class="lab-w"><span>Background <b id="lab-b"></b></span><div class="lab-wheel" id="lab-wb"></div>
        <label>Lightness<input type="range" id="lab-bl" min="0" max="0.14" step="0.002"></label>
        <label>Glow<input type="range" id="lab-bg" min="0" max="1" step="0.01"></label></div>
    </div>
    <div class="lab-foot"><button id="lab-reset">Reset</button><button class="primary" id="lab-copy">Copy palette</button></div>`;
  const fab = document.createElement('button');
  fab.className = 'lab-fab'; fab.setAttribute('aria-label', 'Open colour lab');
  document.body.append(panel, fab);

  const $ = (s) => panel.querySelector(s);
  let placeA, placeB;
  // reflect the state in the panel; when `commit`, also apply it to the page and keep it
  const refresh = (commit = true) => {
    let out;
    if (commit) { document.documentElement.classList.add('lab-on'); out = applyTheme(); save(); }
    else out = { accent: hex(solve(state.a).rgb), bg: hex(hsl2rgb(state.bg.h, state.bg.s, state.bg.l)) };
    $('#lab-a').style.setProperty('--c', out.accent); $('#lab-a').textContent = out.accent;
    $('#lab-b').style.setProperty('--c', out.bg); $('#lab-b').textContent = out.bg;
    $('#lab-ab').value = state.a.b; $('#lab-bl').value = state.bg.l; $('#lab-bg').value = state.bg.g ?? 0;
    const same = (p) => JSON.stringify(p.a) === JSON.stringify(state.a) && JSON.stringify(p.bg) === JSON.stringify(state.bg);
    panel.querySelectorAll('.lab-p').forEach((b) => b.setAttribute('aria-pressed', String(same(PRESETS[b.dataset.i]))));
    placeA?.(); placeB?.();
  };
  placeA = wheel($('#lab-wa'), { l: 0.6, maxS: 0.85, get: () => state.a, set: ({ h, s }) => { state.a = { ...state.a, h, s }; refresh(); } });
  placeB = wheel($('#lab-wb'), { l: 0.32, maxS: 0.4, get: () => state.bg, set: ({ h, s }) => { state.bg = { ...state.bg, h, s }; refresh(); } });
  $('#lab-ab').addEventListener('input', (e) => { state.a = { ...state.a, b: +e.target.value }; refresh(); });
  $('#lab-bl').addEventListener('input', (e) => { state.bg = { ...state.bg, l: +e.target.value }; refresh(); });
  $('#lab-bg').addEventListener('input', (e) => { state.bg = { ...state.bg, g: +e.target.value }; refresh(); });
  panel.querySelector('.lab-presets').addEventListener('click', (e) => {
    const b = e.target.closest('.lab-p'); if (!b) return;
    state = structuredClone(PRESETS[b.dataset.i]); refresh();
  });
  $('#lab-reset').addEventListener('click', () => {
    state = structuredClone(PRESETS[0]);
    try { localStorage.removeItem(KEY); } catch {}
    document.documentElement.classList.remove('lab-on');
    ['--lab-filter', '--lab-bg', '--bg0'].forEach((p) => document.documentElement.style.removeProperty(p));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0B0B0C');
    refresh(false);
  });
  $('#lab-copy').addEventListener('click', async () => {
    const out = applyTheme();
    const txt = `ORION palette: accent ${out.accent} (hue ${Math.round(state.a.h)}°, sat ${Math.round(state.a.s * 100)}%, brightness ${state.a.b}), background ${out.bg}${state.bg.g ? ` with a ${Math.round(state.bg.g * 100)}% glow` : ''}`;
    try { await navigator.clipboard.writeText(txt); $('#lab-copy').textContent = 'Copied'; } catch { prompt('Copy this:', txt); }
    setTimeout(() => ($('#lab-copy').textContent = 'Copy palette'), 1400);
  });
  const setOpen = (on) => {
    open = on; panel.hidden = !on; fab.hidden = on;
    try { localStorage.setItem(OPEN_KEY, on ? '1' : '0'); } catch {}
  };
  $('.lab-x').addEventListener('click', () => setOpen(false));
  fab.addEventListener('click', () => setOpen(true));
  setOpen(open);
  refresh(touched);
}
