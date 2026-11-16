/**
 * Orbit: ORION's avatar. A gold dot inside three rings, drawn on a canvas.
 *
 * It's never quite still:
 * - Idle: the dot breathes, the rings drift a little out of round, a soft glint
 *   slides round each ring, and the colour wanders slowly through the golds
 *   (now and then towards rose gold).
 * - Thinking / working: the rings split into nine bays each and fire in a
 *   radial-engine order (1-3-5-7-9-2-4-6-8), inner ring to outer, like cylinders
 *   igniting. Each firing flashes white-hot, kicks the bay outward and cools to
 *   amber. Working revs faster than thinking.
 * - Speaking: ripples leave the dot (on each streamed burst of text, or peaks in
 *   his voice level) and light each ring up as they pass through it.
 * - Listening: the rings draw in with the mic level, in a cooler cream.
 * - Needs you: coral, with a slow pulse on the outer ring.
 * - Pointer: the rings lean towards the pointer (inner least, outer most); hover
 *   swells the dot; pressing squeezes it and sends out a ripple.
 *
 * API (unchanged for app.js): onSelect, setTools, toolEvent, select, setState,
 * setLevel, talk, paused.
 */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/** Critically damped follower, so every change eases. */
class Ease {
  constructor(v = 0, response = 0.5) { this.x = v; this.v = 0; this.target = v; this.w = TAU / response; }
  step(dt) {
    // small sub-steps keep fast springs stable through long frames
    const n = Math.max(1, Math.ceil((dt * this.w) / 0.4)), h = dt / n, w = this.w;
    for (let i = 0; i < n; i++) {
      this.v += (-w * w * (this.x - this.target) - 2 * w * this.v) * h;
      this.x += this.v * h;
    }
  }
  snap(v) { this.x = this.target = v; this.v = 0; }
}

const DISC = 0.19;                       // dot radius, share of the space's radius
const RINGS = [                          // radius, thickness, drift speed (rad/s)
  { r: 0.40, w: 0.060, spin: 0.21 },
  { r: 0.585, w: 0.050, spin: -0.15 },
  { r: 0.77, w: 0.040, spin: 0.11 },
];
const BAYS = 9;
const ORDER = [0, 2, 4, 6, 8, 1, 3, 5, 7]; // a nine-cylinder radial's firing order
const BAY = TAU / BAYS;

/** Colour per state: [hue, saturation %, lightness %]. Gold family; coral means you're needed. */
const MOOD = {
  idle: [40, 60, 74],
  listening: [44, 38, 84],
  thinking: [33, 82, 66],
  working: [29, 86, 63],
  speaking: [42, 70, 76],
  'needs-you': [10, 66, 66],
  sleeping: [38, 24, 50],
  error: [5, 70, 60],
};
const hsl = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${clamp(l, 0, 100).toFixed(1)}%,${clamp(a, 0, 1).toFixed(3)})`;

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
    this.t = 0;
    this.last = performance.now();

    // colour
    const [h, s, l] = MOOD.idle;
    this.h = new Ease(h, 1.1); this.s = new Ease(s, 1.1); this.l = new Ease(l, 1.1);
    this.drift = new Ease(1, 1.5);       // how much the idle colour wander shows

    // motion
    this.level = new Ease(0, 0.12);      // voice or mic level
    this.talkE = new Ease(0, 0.2);
    this.talkT = 0;
    this.engine = new Ease(0, 0.6);      // 0 = whole rings, 1 = bays open and firing
    this.rpm = 0;                        // fires per second
    this.acc = 0; this.seq = 0;
    this.kick = 0;                       // the dot's jolt on each firing
    this.hover = new Ease(0, 0.35);
    this.press = new Ease(0, 0.18);
    this.px = new Ease(0, 0.6); this.py = new Ease(0, 0.6);   // pointer lean
    this.listen = new Ease(0, 0.5);
    this.alarm = new Ease(0, 0.6);
    this.ripples = [];
    this.lastRipple = 0;
    this.prevLevel = 0;
    this.rings = RINGS.map((g, i) => ({ ...g, a: i * 1.3, heat: new Float32Array(BAYS), flash: 0, bump: 0 }));

    new ResizeObserver(() => this.#resize()).observe(host);
    this.#resize();
    this.cv.addEventListener('pointermove', (e) => this.#pointer(e));
    this.cv.addEventListener('pointerleave', () => { this.hover.target = 0; this.px.target = 0; this.py.target = 0; this.press.target = 0; this.cv.style.cursor = ''; });
    this.cv.addEventListener('pointerdown', (e) => { if (this.#inside(e)) { this.press.target = 1; this.#ripple(0.7); } });
    addEventListener('pointerup', () => { this.press.target = 0; });
    this.cv.addEventListener('click', (e) => { if (this.#inside(e)) this.onSelect?.('leo'); });
    requestAnimationFrame((n) => this.#frame(n));
  }

  /* ---------- API ---------- */

  setTools() {}                          // the rings are ORION himself now, not his tools

  /** A tool call lights the rings: a quick ripple when one starts. */
  toolEvent(e) {
    if (e.phase === 'call') this.#ripple(0.55);
    else if (e.phase === 'result') this.rings[1].flash = Math.max(this.rings[1].flash, 0.5);
  }

  select(id) { this.selected = id; }

  setState(state) {
    this.state = state;
    this.host.dataset.state = state;
    const [h, s, l] = MOOD[state] ?? MOOD.idle;
    this.h.target = h; this.s.target = s; this.l.target = l;
    this.drift.target = state === 'idle' || state === 'sleeping' ? 1 : 0;
    this.engine.target = state === 'thinking' || state === 'working' ? 1 : 0;
    this.listen.target = state === 'listening' ? 1 : 0;
    this.alarm.target = state === 'needs-you' || state === 'error' ? 1 : 0;
    if (reduced.matches) for (const e of [this.h, this.s, this.l, this.engine, this.listen, this.alarm, this.drift]) e.snap(e.target);
  }

  /** ORION's voice level, 0–1 (or the mic while listening). */
  setLevel(v) { this.level.target = clamp(v, 0, 1); }

  /** A burst of speech: call it as each piece of a reply streams in. */
  talk(strength = 1) {
    this.talkT = clamp(this.talkT * 0.45 + (0.4 + Math.random() * 0.4) * strength, 0, 1);
    if (this.t - this.lastRipple > 0.16) this.#ripple(0.35 + 0.5 * strength * Math.random());
  }

  /* ---------- internals ---------- */

  #ripple(strength) {
    this.lastRipple = this.t;
    if (reduced.matches) { this.rings.forEach((r) => { r.flash = Math.max(r.flash, strength * 0.6); }); return; }
    if (this.ripples.length < 10) this.ripples.push({ r: DISC, s: clamp(strength, 0, 1) });
  }

  #resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = this.host.clientWidth, H = this.host.clientHeight;
    if (!W || !H) return;
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.cv.style.width = `${W}px`; this.cv.style.height = `${H}px`;
    this.#draw();
  }

  #geom() {
    const R = Math.min(this.W, this.H) / 2 * 0.96;
    return { cx: this.W / 2, cy: this.H / 2, R };
  }

  #local(e) {
    const r = this.cv.getBoundingClientRect();
    const { cx, cy, R } = this.#geom();
    return { x: (e.clientX - r.left - cx) / R, y: (e.clientY - r.top - cy) / R };
  }
  #inside(e) { const p = this.#local(e); return Math.hypot(p.x, p.y) <= RINGS[2].r + RINGS[2].w; }

  #pointer(e) {
    if (!this.W) return;
    const p = this.#local(e);
    const d = Math.hypot(p.x, p.y);
    const inside = d <= RINGS[2].r + RINGS[2].w;
    this.hover.target = inside ? 1 : 0;
    this.cv.style.cursor = inside ? 'pointer' : '';
    this.cv.title = inside ? 'ORION' : '';
    const k = Math.min(1, d) / (d || 1);
    this.px.target = p.x * k; this.py.target = p.y * k;
  }

  #frame(now) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    requestAnimationFrame((n) => this.#frame(n));   // first, so one bad frame can't stop him
    if (!this.paused && this.W) { this.#step(dt); this.#draw(); }
  }

  #step(dt) {
    this.t += dt;
    const still = reduced.matches;
    for (const e of [this.h, this.s, this.l, this.drift, this.level, this.talkE, this.engine, this.hover, this.press, this.px, this.py, this.listen, this.alarm]) e.step(dt);
    this.talkT *= Math.exp(-dt * 3.2);
    this.talkE.target = this.talkT;
    this.kick *= Math.exp(-dt * 10);

    // voice peaks send ripples while he speaks
    const lv = this.level.x;
    if (this.state === 'speaking' && lv > 0.28 && lv > this.prevLevel + 0.04 && this.t - this.lastRipple > 0.14) this.#ripple(0.3 + lv * 0.6);
    this.prevLevel = lv;

    // the engine: one bay fires per tick, round the rings in firing order
    const firing = this.engine.x > 0.35;
    const base = this.state === 'working' ? 15 : 10;
    this.rpm = base * (1 + 0.14 * Math.sin(this.t * 1.3));
    if (firing) {
      this.acc += dt * this.rpm;
      while (this.acc >= 1) {
        this.acc -= 1;
        const s = this.seq++;
        const k = s % 3;
        const bay = ORDER[(Math.floor(s / 3) + k * 3) % BAYS];
        this.rings[k].heat[bay] = 1;
        this.kick = Math.min(1, this.kick + 0.3);
      }
    } else this.acc = 0;

    // ripples run out and light each ring they pass through
    const { R } = this.#geom();
    const E = this.#energy();
    for (const rg of this.rings) {
      for (let i = 0; i < BAYS; i++) rg.heat[i] *= Math.exp(-dt * 6.5);
      rg.flash *= Math.exp(-dt * 4.2);
      rg.bump = 0;
      if (!still) rg.a += dt * rg.spin * (0.35 + this.engine.x * 2.2 + E * 0.8);
    }
    for (const p of this.ripples) {
      p.r += dt * (0.55 + p.s * 0.35);
      for (const rg of this.rings) {
        const near = Math.exp(-(((p.r - rg.r) / 0.05) ** 2)) * p.s;
        rg.flash = Math.max(rg.flash, near);
        rg.bump += near * 0.03;
      }
    }
    this.ripples = this.ripples.filter((p) => p.r < 1.04);
    this.R = R;
  }

  #energy() { return reduced.matches ? 0 : clamp(Math.max(0, this.level.x) * 0.9 + Math.max(0, this.talkE.x) * 0.75, 0, 1.1); }

  /** The current colour, with the idle wander mixed in. */
  #colour() {
    const t = this.t, d = this.drift.x * (reduced.matches ? 0 : 1);
    const rose = Math.max(0, Math.sin(t * 0.045)) ** 3;      // every so often, a slow turn to rose gold
    return {
      h: this.h.x + d * (5 * Math.sin(t * 0.11) - 18 * rose),
      s: this.s.x + d * (4 * Math.sin(t * 0.08 + 1) - 6 * rose),
      l: this.l.x + d * 3 * Math.sin(t * 0.07 + 2),
    };
  }

  /** One ring (or a slice of it), a little out of round. */
  #path(cx, cy, r, a0, a1, wob, ph) {
    const { ctx } = this;
    r = Math.max(1, r);
    ctx.beginPath();
    if (wob < 0.15) { ctx.arc(cx, cy, r, a0, a1); return; }
    const n = Math.max(6, Math.ceil((a1 - a0) / 0.045));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const rr = r + wob * (0.6 * Math.sin(3 * a + ph) + 0.4 * Math.sin(5 * a - ph * 1.3));
      const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
  }

  #draw() {
    const { ctx, W, H, dpr } = this;
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { cx, cy, R } = this.#geom();
    const t = this.t, still = reduced.matches;
    const E = this.#energy();
    const { h, s, l } = this.#colour();
    const eng = this.engine.x;
    const listen = clamp(this.listen.x, 0, 1) * clamp(this.level.x, 0, 1);
    const alarmPulse = this.alarm.x * (0.5 + 0.5 * Math.sin(t * 2.4));

    ctx.lineCap = 'butt';

    // a soft halo behind everything when he's busy or talking
    const halo = clamp(eng * 0.5 + E * 0.6 + this.hover.x * 0.15, 0, 1);
    if (halo > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, DISC * R * 0.6, cx, cy, R);
      g.addColorStop(0, hsl(h, s, l, 0.16 * halo));
      g.addColorStop(1, hsl(h, s, l, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // ripples, faint, between the rings
    for (const p of this.ripples) {
      const fade = clamp(1 - (p.r - DISC) / (1.04 - DISC), 0, 1);
      ctx.strokeStyle = hsl(h, s - 10, l + 10, 0.32 * p.s * fade);
      ctx.lineWidth = 1 + 2.5 * p.s * fade;
      ctx.beginPath(); ctx.arc(cx, cy, p.r * R, 0, TAU); ctx.stroke();
    }

    // the rings
    this.rings.forEach((rg, k) => {
      const lean = (k + 1) * 0.022 * R;
      const ox = cx + this.px.x * lean, oy = cy + this.py.x * lean;
      const breathe = still ? 0 : Math.sin(t * 1.1 - k * 0.7) * 0.004;
      const ripple = still ? 0 : E * 0.02 * Math.sin(t * 4.6 - k * 0.9);
      const r = R * (rg.r + breathe + ripple + rg.bump - listen * 0.035 * (k + 1) + this.press.x * 0.015 * (k + 1));
      const th = R * rg.w * (1 + rg.flash * 0.25);
      const wob = still ? 0 : R * (0.004 + E * 0.012 + eng * 0.002);
      const ph = t * (0.5 + k * 0.17) + k * 2;
      const outerAlarm = k === 2 ? alarmPulse : 0;
      const baseA = 0.13 + rg.flash * 0.55 + E * 0.08 + listen * 0.4 + outerAlarm * 0.5 + (this.selected === 'leo' ? 0.06 : 0) + this.hover.x * 0.05;

      ctx.lineWidth = th;
      const gap = eng * 0.16;                          // the bays open up when the engine runs
      if (gap < 0.004) {
        this.#path(ox, oy, r, 0, TAU, wob, ph);
        ctx.strokeStyle = hsl(h, s - 18, l - 8, baseA);
        ctx.stroke();
      } else {
        ctx.strokeStyle = hsl(h, s - 18, l - 8, baseA);
        for (let i = 0; i < BAYS; i++) {
          const a0 = rg.a + i * BAY + gap / 2;
          this.#path(ox, oy, r, a0, a0 + BAY - gap, wob, ph);
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = 'lighter';

      // the glint: a soft light sliding round the ring
      if (!still) {
        const ga = rg.a * 1.8 + t * (0.25 + k * 0.08) * (k % 2 ? -1 : 1);
        const glint = 0.07 + 0.05 * Math.sin(t * 0.6 + k);
        for (let j = -3; j <= 3; j++) {
          const a0 = ga + j * 0.16;
          ctx.strokeStyle = hsl(h, s - 20, l + 6, glint * Math.exp(-(j * j) / 4));
          this.#path(ox, oy, r, a0, a0 + 0.165, wob, ph);
          ctx.stroke();
        }
      }

      // fired bays: white-hot, kicked outward, cooling to amber
      if (gap >= 0.004) {
        for (let i = 0; i < BAYS; i++) {
          const q = rg.heat[i];
          if (q < 0.01) continue;
          const a0 = rg.a + i * BAY + gap / 2;
          const rr = r + q * R * 0.018 * (still ? 0 : 1);
          ctx.lineWidth = th * (1 + q * 1.6);
          ctx.strokeStyle = hsl(h - 4 * (1 - q), s, l, 0.16 * q);
          this.#path(ox, oy, rr, a0, a0 + BAY - gap, wob, ph); ctx.stroke();
          ctx.lineWidth = th;
          ctx.strokeStyle = hsl(h + 6 * q, s - 25 * q, l + 22 * q, 0.85 * q);
          this.#path(ox, oy, rr, a0, a0 + BAY - gap, wob, ph); ctx.stroke();
        }
      }

      // a passing ripple lights the whole ring
      if (rg.flash > 0.02) {
        ctx.lineWidth = th * 2.2;
        ctx.strokeStyle = hsl(h, s, l + 8, 0.12 * rg.flash);
        this.#path(ox, oy, r, 0, TAU, wob, ph); ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
    });

    // the dot
    const breathe = still ? 0 : 0.025 * Math.sin(t * 1.25);
    const cr = DISC * R * Math.max(0.5, 1 + breathe + E * 0.06 + this.kick * 0.045 + this.hover.x * 0.04 - this.press.x * 0.08 + listen * 0.05);
    const dx = cx + this.px.x * R * 0.01, dy = cy + this.py.x * R * 0.01;
    const g = ctx.createRadialGradient(dx - cr * 0.3, dy - cr * 0.35, cr * 0.1, dx, dy, cr);
    g.addColorStop(0, hsl(h, s - 10, l + 10 + this.kick * 8));
    g.addColorStop(1, hsl(h, s, l - 4));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(dx, dy, cr, 0, TAU); ctx.fill();

    if (this.selected === 'leo' || this.alarm.x > 0.05) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.alarm.x > 0.05 ? hsl(h, s, l, 0.5 + 0.3 * alarmPulse) : 'rgba(244,240,232,0.45)';
      ctx.beginPath(); ctx.arc(dx, dy, cr + 6, 0, TAU); ctx.stroke();
    }
  }
}
