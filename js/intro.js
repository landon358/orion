/**
 * The opening. Gold threads weave the five letters of ORION while, on their
 * left, the sphere weaves itself in at the same time: ring after ring of
 * three-strand thread, each with a needle of light at its end, growing from
 * the middle out to the poles, then a fine dial traced round it. Then the
 * letters fly off to their places in the top bar and the sphere glides into
 * its place on the home screen as the app appears underneath.
 * Click or press any key to skip. Once per browser session; tapping the
 * logo in the top bar (or ?intro in the URL) replays it.
 *
 * With `gate` (the login), the capitals first fly back together into ORION,
 * centred at the top of the screen, and the login appears beneath it. Once
 * `gate(panel)` resolves, ORION glides from there to its place in the top bar.
 */
import { orionLetters } from './logo.js';
import { Orbit } from './orbit.js';

const GLIDE = 'cubic-bezier(0.5, 0, 0.15, 1)';
const SOFT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const BRAND = { strands: 3, spread: 1.6 };      // must match the top-bar logo so the hand-off is seamless
const VB = { x: 0, y: 10, w: 524 };             // the top-bar logo's viewBox
const ORB = 1.75;                               // the sphere's size, in cap heights
const ORB_GAP = 0.34;                           // the space between it and the O, in cap heights
let running = false;

export async function playIntro({ brand, force = false, gate = null } = {}) {
  if (running) return;
  try { if (!force && !gate && sessionStorage.getItem('orion-intro')) return; sessionStorage.setItem('orion-intro', '1'); } catch { /* storage off: just play */ }
  running = true;
  document.body.classList.add('intro-run');

  const big = orionLetters({ animate: true });
  const landing = orionLetters(BRAND);
  const el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="intro-bg"></div><div class="intro-glow"></div>
    <div class="intro-words"><span class="intro-orb"><i></i></span>${big.map((L) => `<span class="cap">${L.svg}</span>`).join('')}</div>`;
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
  const slot = el.querySelector('.intro-orb');
  const orbHost = slot.firstElementChild;
  const caps = [...el.querySelectorAll('.cap')];
  const threads = caps.map((c) => c.querySelector('svg'));
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

  // the sphere sits on the left, centred on the letters' cap height; the threads at logo spacing after it
  const orbD = Math.round(capH * ORB), orbW = orbD + capH * ORB_GAP;
  Object.assign(orbHost.style, { width: `${orbD}px`, height: `${orbD}px`, top: `${baseY - capH / 2 - orbD / 2}px` });
  slot.style.width = `${orbW}px`;
  const orb = new Orbit(orbHost, { weave: true });
  orb.reveal = 0;
  if (location.hostname === 'localhost') window.__intro = { orb };

  const cw0 = big.map((L) => (L.x1 - L.x0) * u);
  const m0 = big.map((L) => L.gap * u);
  caps.forEach((c, i) => Object.assign(threads[i].style, { width: `${cw0[i]}px`, height: `${108 * u}px`, top: `${baseY - 104 * u}px` }));
  caps.forEach((c, i) => { c.style.width = `${cw0[i]}px`; c.style.marginRight = `${m0[i]}px`; });
  const vw = innerWidth;
  const sC = Math.min(1, (vw < 600 ? 0.86 : 0.5) * vw / words.offsetWidth);
  words.style.transform = `scale(${sC})`;
  words.style.visibility = 'visible';

  /** The rings weave in over `ms`, after `delay`, easing out. A skip finishes them at once. */
  const weave = (ms, delay) => new Promise((r) => {
    const t0 = performance.now() + delay;
    const step = (now) => {
      const t = skipped ? 1 : Math.max(0, Math.min(1, (now - t0) / ms));
      orb.reveal = 1 - (1 - t) ** 1.6;
      if (t < 1 && !orb.dead) requestAnimationFrame(step); else r();
    };
    requestAnimationFrame(step);
  });

  if (!reduced.matches && !skipped) {
    // 1. threads weave ORION, letter by letter, and the sphere weaves itself in beside them
    el.classList.add('on');
    anim(glow, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 2200, easing: SOFT });
    anim(orbHost, [{ opacity: 0, transform: 'scale(0.86) rotate(-24deg)' }, { opacity: 1, transform: 'none' }], { duration: 2400, easing: SOFT });
    weave(2700, 0);
    await wait(2700 + (gate ? 700 : 1200));
  }
  orb.reveal = 1;

  // 3. the words fade; the capitals fly to their places (the top bar, or with a login the title
  //    at the top of the screen) and become threads again
  const target = brand?.querySelector('svg');
  const still = reduced.matches;
  const fast = (skipped && !gate) || still || !target;
  const Dur = still ? 0 : fast ? 420 : skipped ? 700 : 1250;
  const flyers = [];
  /** Where each landing letter sits for a logo drawn at box {left, top, width}. */
  const spot = (box, L) => { const ub = box.width / VB.w; return { x: box.left + (L.x0 - VB.x) * ub, y: box.top + (16 - VB.y) * ub, ub }; };
  const title = { width: Math.min(72, innerWidth * 0.2) };
  Object.assign(title, { left: (innerWidth - title.width) / 2, top: innerWidth < 600 ? 30 : 36 });
  const dest = gate ? title : target?.getBoundingClientRect();

  /** The sphere glides into its place on the home screen and hands over to it; with a login, or
   *  when that sphere isn't on screen, it fades where it is. */
  const flyOrb = (afterLogin = false) => {
    const r = orbHost.getBoundingClientRect();
    const home = document.getElementById('orbit')?.getBoundingClientRect();
    const seen = (!gate || afterLogin) && !still && home && home.width > 40 && home.height > 40 && home.bottom > 0 && home.top < innerHeight;
    if (!seen) {
      anim(slot, [{ opacity: 1, filter: 'blur(0px)', transform: 'none' }, { opacity: 0, filter: 'blur(6px)', transform: 'scale(0.85)' }], { duration: still ? 0 : 600, easing: 'ease-in' });
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'intro-orbfly';
    Object.assign(wrap.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${orbD}px`, height: `${orbD}px` });
    orbHost.getAnimations().forEach((a) => a.cancel());
    Object.assign(orbHost.style, { top: '0px', width: `${orbD}px`, height: `${orbD}px` });
    wrap.append(orbHost);
    el.append(wrap);
    // the home sphere's radius (see Orbit #geom), so the two line up as one fades into the other
    const homeR = (Math.min(home.width, home.height) / 2) * (document.body.classList.contains('orb-side') ? 0.8 : 0.84);
    const k0 = r.width / orbD, k1 = homeR / (orbD / 2 * 0.84);
    const dx = home.left + home.width / 2 - (orbD * k1) / 2 - r.left, dy = home.top + home.height / 2 - (orbD * k1) / 2 - r.top;
    const ms = Dur * 1.15;
    wrap.animate([{ transform: `scale(${k0})` }, { transform: `translate(${dx}px, ${dy}px) scale(${k1})` }], { duration: ms, delay: 120, easing: GLIDE, fill: 'both' });
    wrap.animate([{ opacity: 1 }, { opacity: 1, offset: 0.62 }, { opacity: 0 }], { duration: ms + 200, delay: 120, easing: 'ease-in-out', fill: 'both' });
  };

  /** With a login, the sphere glides down into its seat above the form and stays there, alive. */
  const seatOrb = async (seat, after) => {
    const r = orbHost.getBoundingClientRect(), to = seat.getBoundingClientRect();
    const wrap = document.createElement('div');
    wrap.className = 'intro-orbfly';
    Object.assign(wrap.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${orbD}px`, height: `${orbD}px` });
    orbHost.getAnimations().forEach((a) => a.cancel());
    orbHost.style.top = '0px';
    wrap.append(orbHost);
    el.append(wrap);
    const k0 = r.width / orbD, k1 = to.width / orbD;
    const a = wrap.animate([{ transform: `scale(${k0})` }, { transform: `translate(${to.left - r.left}px, ${to.top - r.top}px) scale(${k1})` }],
      { duration: still ? 0 : 1300, easing: GLIDE, fill: 'both' });
    await Promise.all([a.finished, after.finished]);
    Object.assign(orbHost.style, { width: '100%', height: '100%', top: '0px' });
    seat.append(orbHost);
    wrap.remove();
  };

  if (!fast || gate) {
    all.forEach((a) => a.finish());
    if (!gate) flyOrb();
    if (!gate) glow.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.8)' }], { duration: Dur, easing: 'ease-in', fill: 'both' });
    threads.forEach((t, i) => {
      const L = landing[i];
      const r = t.getBoundingClientRect();
      // where the woven letter is now, and where its top-bar twin lands
      const sx = r.left, sy = r.top;
      const { x: tx, y: ty, ub } = spot(dest, L);
      const tw = (L.x1 - L.x0) * ub, th = 108 * ub;
      const k = (u * sC) / ub;
      const fly = document.createElement('div');
      fly.className = 'intro-flyer';
      Object.assign(fly.style, { left: `${tx}px`, top: `${ty}px`, width: `${tw}px`, height: `${th}px` });
      // the big letter's threads hand over to the top bar's finer ones on the way
      const from = t.cloneNode(true);
      from.classList.remove('draw');
      from.removeAttribute('style');
      fly.innerHTML = L.svg;
      fly.prepend(from);
      el.append(fly);
      flyers.push({ fly, L, tx, ty, ub });
      t.style.visibility = 'hidden';
      const delay = still ? 0 : i * 70;
      fly.animate([
        { transform: `translate(${sx - tx}px, ${sy - ty}px) scale(${k})` },
        { transform: 'none' },
      ], { duration: Dur, delay, easing: GLIDE, fill: 'both' });
      from.animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: Dur * 0.8, delay, easing: 'ease-in-out', fill: 'both' });
      fly.lastElementChild.animate([{ opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 1 }], { duration: Dur * 0.8, delay, easing: 'ease-in-out', fill: 'both' });
    });
    if (!gate) await new Promise((r) => setTimeout(r, 160));
  } else {
    all.forEach((a) => a.finish());
    words.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Dur, fill: 'both' });
  }

  // 3b. the login, under the title; when it's done ORION glides on to the top bar
  if (gate) {
    el.removeEventListener('pointerdown', skip);
    removeEventListener('keydown', skip);
    el.classList.add('gated');
    el.removeAttribute('aria-hidden');
    words.setAttribute('aria-hidden', 'true');
    glow.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Dur || 1, easing: 'ease-in-out', fill: 'both' });

    const panel = document.createElement('div');
    panel.className = 'gate-wrap';
    el.append(panel);
    const done = gate(panel, { orb });
    const show = panel.animate([{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }],
      { duration: still ? 0 : 800, delay: still ? 0 : Dur * 0.45, easing: SOFT, fill: 'both' });
    if (!still) [...panel.querySelectorAll('[data-rise]')].forEach((n, i) => n.animate(
      [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 900, delay: Dur * 0.45 + 120 + i * 80, easing: SOFT, fill: 'backwards' }));
    const seat = panel.querySelector('.gate-orb');
    if (seat) seatOrb(seat, show);
    else anim(slot, [{ opacity: 1 }, { opacity: 0 }], { duration: still ? 0 : 600 });

    await done;
    orb.setState('idle');
    if (seat) { await show.finished; flyOrb(true); }
    await panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: still ? 0 : 320, easing: 'ease-in', fill: 'both' }).finished;
    el.setAttribute('aria-hidden', 'true');

    const b2 = target?.getBoundingClientRect();
    const move = still || !b2 ? 0 : 1000;
    
    if (b2) flyers.forEach(({ fly, L, tx, ty, ub }, i) => {
      const { x, y, ub: ub2 } = spot(b2, L);
      fly.getAnimations().forEach((a) => a.finish());
      fly.animate([{ transform: 'none' }, { transform: `translate(${x - tx}px, ${y - ty}px) scale(${ub2 / ub})` }],
        { duration: move, delay: still ? 0 : i * 40, easing: GLIDE, fill: 'both' });
    });
  }

  el.querySelector('.intro-bg').animate([{ opacity: 1 }, { opacity: 0 }], { duration: gate ? (still ? 0 : 1000) : fast ? Dur : 1000, easing: 'ease-in-out', fill: 'both' });
  document.body.classList.add('intro-out');
  await new Promise((r) => setTimeout(r, gate ? (still ? 40 : 1000 + 4 * 40 + 40) : fast ? Dur + 40 : Dur + 4 * 70 - 120));
  document.body.classList.remove('intro-run', 'intro-out');
  orb.stop();
  el.remove();
  removeEventListener('keydown', skip);
  running = false;
}
