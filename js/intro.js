/**
 * The opening. Gold threads draw the five letters of ORION. As the name
 * unfolds into "Orchestrated Reasoning & Intelligent Operations Network",
 * each thread letter turns into a solid letter. Then the words fade and the
 * five capitals fly off to their places in the top bar, becoming threads
 * again as they land, while the app appears underneath.
 * Click or press any key to skip. Once per browser session; tapping the
 * logo in the top bar (or ?intro in the URL) replays it.
 */
import { orionLetters } from './logo.js';

const WORDS = [['O', 'rchestrated '], ['R', 'easoning '], ['', '& '], ['I', 'ntelligent '], ['O', 'perations '], ['N', 'etwork']];
const LINES = [['O', 'rchestrated'], ['R', 'easoning <span class="ampc">&amp;</span>'], ['I', 'ntelligent'], ['O', 'perations'], ['N', 'etwork']];
const SMOOTH ='cubic-bezier(0.65, 0, 0.35, 1)';
const GLIDE = 'cubic-bezier(0.5, 0, 0.15, 1)';
const SOFT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const BRAND = { strands: 3, spread: 1.6 };      // must match the top-bar logo so the hand-off is seamless
const VB = { x: 0, y: 10, w: 524 };             // the top-bar logo's viewBox
let running = false;

export async function playIntro({ brand, force = false } = {}) {
  if (running) return;
  try { if (!force && sessionStorage.getItem('orion-intro')) return; sessionStorage.setItem('orion-intro', '1'); } catch { /* storage off: just play */ }
  running = true;
  document.body.classList.add('intro-run');

  const big = orionLetters({ animate: true });
  const landing = orionLetters({ ...BRAND, animate: true });
  const el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('aria-hidden', 'true');
  // phones stack the words, one per line; wider screens unfold them along one line
  const stack = innerWidth < 600;
  let li = 0;
  const capHtml = (c) => `<span class="cap"><span class="ch">${c}</span>${big[li++].svg}</span>`;
  el.innerHTML = `<div class="intro-bg"></div><div class="intro-glow"></div>
    <div class="intro-words${stack ? ' stack' : ''}">${stack
      ? LINES.map(([cap, rest]) => `<span class="iw">${capHtml(cap)}<span class="rest"><span class="rt">${rest}</span></span></span>`).join('')
      : WORDS.map(([cap, rest]) => `<span class="iw">${cap ? capHtml(cap) : ''}<span class="rest${cap ? '' : ' amp'}"><span class="rt">${rest.replace('&', '&amp;')}</span></span></span>`).join('')}</div>`;
  document.body.append(el);

  let skipped = false;
  const wakers = new Set();
  const wait = (ms) => new Promise((r) => {
    if (skipped) return r();
    const t = setTimeout(() => { wakers.delete(w); r(); }, ms);
    const w = () => { clearTimeout(t); r(); };
    wakers.add(w);
  });
  const skip = () => { if (skipped) return; skipped = true; wakers.forEach((w) => w()); };
  el.addEventListener('pointerdown', skip);
  addEventListener('keydown', skip, { once: true });

  const words = el.querySelector('.intro-words');
  const caps = [...el.querySelectorAll('.cap')];
  const chars = caps.map((c) => c.querySelector('.ch'));
  const threads = caps.map((c) => c.querySelector('svg'));
  const rests = [...el.querySelectorAll('.rest')];
  const texts = rests.map((r) => r.firstElementChild);
  const glow = el.querySelector('.intro-glow');
  const all = [];
  const anim = (node, frames, opts) => { const a = node.animate(frames, { fill: 'both', ...opts }); all.push(a); return a; };

  await Promise.race([document.fonts?.ready, wait(600)]);

  // font metrics: logo units → px, and where the baseline sits in a line
  const cs = getComputedStyle(words);
  const F = parseFloat(cs.fontSize);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${cs.fontWeight} ${F}px ${cs.fontFamily}`;
  const m = ctx.measureText('H');
  const capH = m.actualBoundingBoxAscent || F * 0.7;
  const A = m.fontBoundingBoxAscent || F * 0.95, D = m.fontBoundingBoxDescent || F * 0.25;
  const u = capH / 100;
  const lineH = parseFloat(cs.lineHeight) || F * 1.1;
  const baseY = (lineH - (A + D)) / 2 + A;                   // baseline, from the top of a line box

  // closed: thread letters at logo spacing. open: solid letters, words after them
  const cw0 = big.map((L) => (L.x1 - L.x0) * u);
  const cw1 = chars.map((c) => c.getBoundingClientRect().width);
  const m0 = big.map((L) => L.gap * u);
  const widths = texts.map((t) => t.getBoundingClientRect().width);
  caps.forEach((c, i) => Object.assign(threads[i].style, { width: `${cw0[i]}px`, height: `${108 * u}px`, top: `${baseY - 104 * u}px` }));
  const vw = innerWidth;
  const logoW = cw0.reduce((a, b) => a + b, 0) + m0.reduce((a, b) => a + b, 0);
  let W0 = 0, W1 = 0, sC = 1, sE = 1, stackFrom = [];
  if (!stack) {
    caps.forEach((c, i) => { c.style.width = `${cw0[i]}px`; c.style.marginRight = `${m0[i]}px`; });
    rests.forEach((r) => { r.style.width = '0px'; });
    W0 = words.offsetWidth;
    W1 = W0 - logoW + cw1.reduce((a, b) => a + b, 0) + widths.reduce((a, b) => a + b, 0);
    sC = Math.min(1, 0.4 * vw / W0);
    sE = Math.min(sC, 0.86 * vw / W1);
    words.style.transform = `scale(${sC})`;
  } else {
    // a fixed column as wide as the longest line, so nothing shifts as the words grow
    const colW = Math.max(...[...words.children].map((l) => l.getBoundingClientRect().width));
    const colH = words.getBoundingClientRect().height;
    words.style.width = `${colW}px`;
    sE = Math.min(1, 0.8 * vw / colW, 0.6 * innerHeight / colH);
    sC = Math.min(1.25, 0.66 * vw / logoW);
    rests.forEach((r) => { r.style.width = '0px'; });
    words.style.transform = `scale(${sE})`;
    // where each capital sits in ORION, centred on screen; it starts there and slides into its line
    const box = words.getBoundingClientRect();
    const top = box.top + box.height / 2 + (capH * sC) / 2 - baseY * sC;
    let x = box.left + box.width / 2 - (logoW * sC) / 2;
    stackFrom = caps.map((c, i) => {
      const r = c.getBoundingClientRect();
      const t = `translate(${((x - r.left) / sE).toFixed(2)}px, ${((top - r.top) / sE).toFixed(2)}px) scale(${(sC / sE).toFixed(4)})`;
      x += (cw0[i] + m0[i]) * sC;
      return t;
    });
    caps.forEach((c, i) => { c.style.transformOrigin = '0 0'; c.style.transform = stackFrom[i]; });
  }
  words.style.visibility = 'visible';

  /** Widths, gaps and zoom from one curve, so the line's on-screen width never overshoots. */
  const unfold = () => {
    const v0 = W0 * sC, v1 = W1 * sE;
    const N = 32, rest = widths.map(() => []), cap = cw0.map(() => []), zoom = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, e = inOut(t);
      widths.forEach((w, j) => rest[j].push({ width: `${(w * e).toFixed(2)}px`, offset: t }));
      cw0.forEach((w, j) => cap[j].push({ width: `${(w + (cw1[j] - w) * e).toFixed(2)}px`, marginRight: `${(m0[j] * (1 - e)).toFixed(2)}px`, offset: t }));
      zoom.push({ transform: `scale(${((v0 + (v1 - v0) * e) / (W0 + (W1 - W0) * e)).toFixed(4)})`, offset: t });
    }
    return { rest, cap, zoom };
  };

  if (!reduced.matches && !skipped) {
    // 1. threads draw ORION, letter by letter
    el.classList.add('on');
    anim(glow, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 2000, easing: SOFT });
    await wait(1900);

    // 2 (phone). each capital slides into its own line, turning solid, and its word unfolds after it
    if (!skipped && stack) {
      caps.forEach((c, i) => anim(c, [{ transform: stackFrom[i] }, { transform: 'none' }], { duration: 1300, delay: i * 80, easing: SMOOTH }));
      threads.forEach((s, i) => anim(s, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(5px)' }], { duration: 700, delay: 200 + i * 80, easing: 'ease-in-out' }));
      chars.forEach((c, i) => anim(c, [{ opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 800, delay: 300 + i * 80, easing: SOFT }));
      rests.forEach((r, i) => anim(r, [{ width: '0px' }, { width: `${widths[i]}px` }], { duration: 1000, delay: 700 + i * 90, easing: SMOOTH }));
      texts.forEach((t, i) => anim(t, [
        { opacity: 0, filter: 'blur(8px)', transform: 'translateX(-0.25em)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' },
      ], { duration: 900, delay: 780 + i * 90, easing: SOFT }));
      await wait(1800 + 1700);
    }

    // 2. the name unfolds; each thread letter becomes a solid letter
    if (!skipped && !stack) {
      const Dur = 1500;
      const f = unfold();
      anim(words, f.zoom, { duration: Dur, easing: 'linear' });
      rests.forEach((r, i) => anim(r, f.rest[i], { duration: Dur, easing: 'linear' }));
      caps.forEach((c, i) => anim(c, f.cap[i], { duration: Dur, easing: 'linear' }));
      threads.forEach((s, i) => anim(s, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(6px)' }], { duration: 700, delay: 120 + i * 50, easing: 'ease-in-out' }));
      chars.forEach((c, i) => anim(c, [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 800, delay: 220 + i * 50, easing: SOFT }));
      texts.forEach((t, i) => anim(t, [
        { opacity: 0, filter: 'blur(10px)', transform: 'translateX(-0.25em)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' },
      ], { duration: 1000, delay: 420 + i * 70, easing: SOFT }));
      await wait(Dur + 1600);
    }
  }

  // 3. the words fade; the capitals fly to their places in the top bar and become threads again
  const target = brand?.querySelector('svg');
  const fast = skipped || reduced.matches || !target;
  const Dur = fast ? 420 : 1250;
  if (!fast) {
    const b = target.getBoundingClientRect();
    const ub = b.width / VB.w;
    const s = sE;
    texts.forEach((t, i) => anim(t, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(10px)' }], { duration: 420, delay: i * 30, easing: 'ease-in' }));
    glow.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.8)' }], { duration: Dur, easing: 'ease-in', fill: 'both' });
    chars.forEach((c, i) => {
      const L = landing[i];
      const r = c.getBoundingClientRect();
      // where the solid letter is now (its cap-height box), and where its thread twin sits in the top bar
      const sx = r.left, sy = r.top + (baseY - 104 * u) * s;
      const tx = b.left + (L.x0 - VB.x) * ub, ty = b.top + (16 - VB.y) * ub;
      const tw = (L.x1 - L.x0) * ub, th = 108 * ub;
      const k = (u * s) / ub;
      const fly = document.createElement('div');
      fly.className = 'intro-flyer';
      Object.assign(fly.style, { left: `${tx}px`, top: `${ty}px`, width: `${tw}px`, height: `${th}px` });
      const fs = F * ub / u;                                    // font size whose cap height matches the logo letter
      fly.innerHTML = `<span class="ch" style="font-size:${fs}px;--lh:${((A + D) / F).toFixed(3)};bottom:${4 * ub - (D / F) * fs}px">${c.textContent}</span>${L.svg}`;
      el.append(fly);
      c.style.visibility = 'hidden';
      const delay = i * 70;
      fly.animate([
        { transform: `translate(${sx - tx}px, ${sy - ty}px) scale(${k})` },
        { transform: 'none' },
      ], { duration: Dur, delay, easing: GLIDE, fill: 'both' });
      fly.querySelector('.ch').animate([{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: Dur * 0.8, delay, easing: 'ease-in-out', fill: 'both' });
      fly.querySelectorAll('path').forEach((p) => p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: Dur * 0.75, delay: delay + Dur * 0.3, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'both' }));
    });
    await new Promise((r) => setTimeout(r, 160));
  } else {
    all.forEach((a) => a.finish());
    words.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Dur, fill: 'both' });
  }
  el.querySelector('.intro-bg').animate([{ opacity: 1 }, { opacity: 0 }], { duration: fast ? Dur : 1000, easing: 'ease-in-out', fill: 'both' });
  document.body.classList.add('intro-out');
  await new Promise((r) => setTimeout(r, fast ? Dur + 40 : Dur + 4 * 70 - 120));
  document.body.classList.remove('intro-run', 'intro-out');
  el.remove();
  removeEventListener('keydown', skip);
  running = false;
}
