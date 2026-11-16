/**
 * Orbit: ORION's avatar, drawn like a backlit instrument from an 80s flight deck.
 *
 * A lamp in the middle and three tight rings of near-square lamp cells (18, 24,
 * 30: the same cell size and the same gap on every ring). Nothing else.
 * Nothing wobbles or drifts. Everything runs on one clock (12 ticks a second),
 * and every cell behaves the same way: it switches on with a quick filament
 * warm-up and cools off a little slower, glowing redder as it dims.
 *
 * - Idle: dark cells, and a three-lamp pointer stepping round once every
 *   18 seconds, like a standby light.
 * - Thinking / working: six sectors fire in a six-cylinder order (1-5-3-6-2-4).
 *   Each firing is a stroke from the inner ring out to the outer, one tick per
 *   ring. Working fires faster than thinking.
 * - Speaking: each burst of his reply (or peak in his voice) sends the same
 *   stroke out through whole rings.
 * - Listening: the rings fill from the top like a level meter with the mic.
 * - Needs you: the outer ring blinks coral, once a second.
 * - Press: a lamp test. Every cell lights for a moment.
 *
 * API (unchanged for app.js): onSelect, setTools, toolEvent, select, setState,
 * setLevel, talk, paused.
 */

const TAU = Math.PI * 2;
const TOP = -Math.PI / 2;
const HZ = 12;                               // the one clock
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// tight: the rings sit close round the lamp and close to each other
const DISC = 0.40;                           // the lamp, as a share of the space's radius
const CELL_W = 0.147;                        // every ring the same thickness
const RING_GAP = 0.04;                       // the same small gap between lamp and rings
const RINGS = [18, 24, 30].map((n, k) => ({ n, r: DISC + RING_GAP + CELL_W / 2 + k * (CELL_W + RING_GAP) }));
const OUTER = RINGS[2].r + CELL_W / 2;
const CELL_GAP = 0.018;                      // and the same gap between cells
const SECTORS = 6;
const FIRING = [0, 4, 2, 5, 1, 3];           // 1-5-3-6-2-4
const RISE = 0.035, FALL = 0.16;             // filament: on fast, off slower (seconds)

const AMBER = 36, CORAL = 9;

export class Orbit {
  /** @param {HTMLElement} host */
  constructor(host) {
    this.host = host;
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('role', 'img');
    this.cv.setAttribute('aria-label', 'ORION');
    host.append(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.onSelect = null;
    this.selected = null;
    this.state = 'idle';
    this.paused = false;
    this.hover = false;
    this.t = 0;
    this.tick = 0;
    this.last = performance.now();
    this.level = 0;                          // voice or mic, 0–1
    this.peak = 0;
    this.lastStroke = -99;
    this.fireAt = 0; this.fireN = 0;
    this.lampTest = -1;
    this.hue = AMBER;
    this.dirty = true;
    // every lamp: value, plus an event hold (lit at `amp` until tick `until`)
    this.rings = RINGS.map((g) => ({ ...g, v: new Float32Array(g.n), amp: new Float32Array(g.n), until: new Int32Array(g.n).fill(-1) }));
    this.core = { v: 0.7 };

    new ResizeObserver(() => this.#resize()).observe(host);
    this.#resize();
    this.cv.addEventListener('pointermove', (e) => {
      const inside = this.#inside(e);
      if (inside !== this.hover) { this.hover = inside; this.dirty = true; }
      this.cv.style.cursor = inside ? 'pointer' : '';
      this.cv.title = inside ? 'ORION' : '';
    });
    this.cv.addEventListener('pointerleave', () => { this.hover = false; this.cv.style.cursor = ''; this.dirty = true; });
    this.cv.addEventListener('pointerdown', (e) => { if (this.#inside(e)) this.lampTest = this.tick; });
    this.cv.addEventListener('click', (e) => { if (this.#inside(e)) this.onSelect?.('leo'); });
    requestAnimationFrame((n) => this.#frame(n));
  }

  /* ---------- API ---------- */

  setTools() {}                              // the rings are ORION himself, not his tools

  /** A tool call sends a soft stroke out through the rings. */
  toolEvent(e) { if (e.phase === 'call') this.#stroke(0.6); }

  select(id) { this.selected = id; this.dirty = true; }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.host.dataset.state = state;
    this.fireAt = this.tick; this.fireN = 0;
    this.dirty = true;
  }

  /** ORION's voice level, 0–1 (or the mic while listening). */
  setLevel(v) { this.level = clamp(v || 0, 0, 1); }

  /** A burst of speech: call it as each piece of a reply streams in. */
  talk(strength = 1) { if (this.tick - this.lastStroke >= 2) this.#stroke(clamp(0.55 + 0.45 * strength, 0, 1)); }

  /* ---------- clockwork ---------- */

  /** Light every cell of each ring, one tick per ring, inner to outer. */
  #stroke(amp, sector = -1) {
    this.lastStroke = this.tick;
    const q = Math.round(amp * 4) / 4;      // brightness comes in steps
    this.rings.forEach((rg, k) => {
      const from = this.tick + (reduced.matches ? 0 : k);
      for (let i = 0; i < rg.n; i++) {
        if (sector >= 0 && Math.floor((i / rg.n) * SECTORS) !== sector) continue;
        rg.amp[i] = Math.max(rg.until[i] > this.tick ? rg.amp[i] : 0, q);
        rg.until[i] = from + 2;              // each ring holds for two ticks
        rg.from ??= new Int32Array(rg.n);
        rg.from[i] = from;
      }
    });
  }

  /** What each cell should show right now, from the state alone. */
  #modeTarget(k, i, rg) {
    const s = this.state, tk = this.tick;
    if (this.lampTest >= 0 && tk - this.lampTest < 5) return 1;
    if (s === 'listening') {
      // a level meter: fills both ways from the top
      const lit = Math.round(this.level * rg.n / 2);
      const d = Math.min(i, rg.n - i);
      return d < lit ? 0.85 : 0;
    }
    if ((s === 'needs-you' || s === 'error') && k === 2) return tk % HZ < HZ / 2 ? 0.9 : 0;
    if (s === 'idle' || s === 'needs-you') {
      // the standby pointer: one lamp per ring, lined up, one step every half second
      if (reduced.matches) return 0;
      const step = Math.floor(tk / 6) % 36;
      const at = Math.round((step / 36) * rg.n) % rg.n;
      return i === at ? 0.55 : 0;
    }
    return 0;
  }

  #frame(now) {
    const dt = clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    requestAnimationFrame((n) => this.#frame(n));
    if (this.paused || !this.W) return;
    this.t += dt;
    const tick = Math.floor(this.t * HZ);
    if (tick !== this.tick) { this.tick = tick; this.#onTick(); }
    if (this.#settle(dt) || this.dirty) this.#draw();
  }

  #onTick() {
    const s = this.state, tk = this.tick;
    // the engine: one sector per interval, in firing order
    if (s === 'thinking' || s === 'working') {
      const every = s === 'working' ? 2 : 3;
      if (tk - this.fireAt >= every) {
        this.fireAt = tk;
        this.#stroke(1, FIRING[this.fireN++ % SECTORS]);
      }
    }
    // voice peaks while he speaks
    if (s === 'speaking' && this.level > 0.3 && this.level > this.peak + 0.05 && tk - this.lastStroke >= 2) this.#stroke(this.level);
    this.peak = this.level;
    this.dirty = true;
  }

  /** Every lamp follows its target the same way. Returns whether anything moved. */
  #settle(dt) {
    const up = 1 - Math.exp(-dt / RISE), down = 1 - Math.exp(-dt / FALL);
    const tk = this.tick;
    let moving = false;
    const step = (v, target) => v + (target - v) * (target > v ? up : down);
    this.rings.forEach((rg, k) => {
      for (let i = 0; i < rg.n; i++) {
        const held = rg.until[i] > tk && (rg.from?.[i] ?? 0) <= tk ? rg.amp[i] : 0;
        const target = Math.max(held, this.#modeTarget(k, i, rg));
        const v = rg.v[i];
        const nv = step(v, target);
        if (Math.abs(nv - v) > 0.002) moving = true;
        rg.v[i] = Math.abs(nv - target) < 0.002 ? target : nv;
      }
    });
    // the centre lamp
    const s = this.state;
    const busy = s === 'thinking' || s === 'working';
    const coreT = s === 'sleeping' ? 0.35
      : s === 'speaking' ? 0.8 + 0.2 * Math.round(this.level * 4) / 4
      : s === 'listening' ? 0.75 + 0.25 * Math.round(this.level * 4) / 4
      : busy ? (tk - this.fireAt < 1 ? 1 : 0.82)
      : 0.72;
    const c = step(this.core.v, coreT);
    if (Math.abs(c - this.core.v) > 0.002) moving = true;
    this.core.v = c;
    const hueT = s === 'needs-you' || s === 'error' ? CORAL : AMBER;
    if (this.hue !== hueT) { this.hue += (hueT - this.hue) * Math.min(1, dt * 10); if (Math.abs(this.hue - hueT) < 0.2) this.hue = hueT; moving = true; }
    return moving;
  }

  /* ---------- drawing ---------- */

  #resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = this.host.clientWidth, H = this.host.clientHeight;
    if (!W || !H) return;
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.cv.style.width = `${W}px`; this.cv.style.height = `${H}px`;
    this.dirty = true;
    this.#draw();
  }

  #geom() { return { cx: this.W / 2, cy: this.H / 2, R: (Math.min(this.W, this.H) / 2) * 0.97 / OUTER }; }

  #inside(e) {
    if (!this.W) return false;
    const r = this.cv.getBoundingClientRect();
    const { cx, cy, R } = this.#geom();
    return Math.hypot(e.clientX - r.left - cx, e.clientY - r.top - cy) <= R * OUTER;
  }

  /** A lamp's colour: deeper and redder as it dims, like a filament. */
  #lamp(v, a = 1) {
    const h = this.hue + (this.hue === CORAL ? 0 : -8 * (1 - v));
    return `hsla(${h.toFixed(1)},${(78 + 8 * v).toFixed(1)}%,${(34 + 36 * v).toFixed(1)}%,${clamp(a, 0, 1).toFixed(3)})`;
  }

  #draw() {
    const { ctx, W, H, dpr } = this;
    if (!W) return;
    this.dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { cx, cy, R } = this.#geom();
    const unlit = this.hover || this.selected === 'leo' ? 0.11 : 0.07;
    const th = CELL_W * R;
    const gapPx = Math.max(2, CELL_GAP * R);
    ctx.lineCap = 'butt';

    // the rings: dark cells, and whichever lamps are lit
    this.rings.forEach((rg) => {
      const r = rg.r * R;
      const step = TAU / rg.n, gap = gapPx / r;
      ctx.lineWidth = th;
      ctx.strokeStyle = `rgba(214,180,106,${unlit})`;
      ctx.beginPath();
      for (let i = 0; i < rg.n; i++) {
        const a0 = TOP + i * step + gap / 2;
        ctx.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
        ctx.arc(cx, cy, r, a0, a0 + step - gap);
      }
      ctx.stroke();

      for (let i = 0; i < rg.n; i++) {
        const v = rg.v[i];
        if (v < 0.01) continue;
        const a0 = TOP + i * step + gap / 2;
        ctx.strokeStyle = this.#lamp(v, 0.25 + 0.75 * v);
        ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + step - gap); ctx.stroke();
      }
    });


    // the centre lamp, flat
    ctx.fillStyle = this.#lamp(this.core.v);
    ctx.beginPath(); ctx.arc(cx, cy, DISC * R, 0, TAU); ctx.fill();
  }
}
