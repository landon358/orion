/**
 * Orbit: ORION's avatar, a sphere drawn in glowing gold rings.
 *
 * Two families of parallel circles cut the sphere around two different axes,
 * so they cross in a woven lattice. It's real 3D: the sphere turns, lines on
 * the far side fall back into a dim glow, and everything is added together in
 * light (`lighter`), so crossings burn brighter like filament.
 *
 * Drawn on a 2D canvas, no WebGL. Segments are bucketed by brightness, so a
 * frame is a couple of dozen strokes however many rings there are.
 * Every state is a set of numbers that ease toward their targets, so any
 * state can take over from any other mid-movement.
 *
 * - Idle: a slow turn.
 * - Thinking: the rings flow through the sphere (one family up, the other
 *   down), the second family's axis swings round the first so the weave
 *   shifts, and a bright scan line sweeps back and forth.
 * - Working: the same, faster.
 * - Speaking: the lattice brightens and swells with his voice; each burst
 *   of a streamed reply sends a pulse of light from top to bottom.
 * - Listening: the rings round the middle light up with the mic.
 * - Needs you: coral, breathing.
 * - Sleeping: dim, barely turning.
 * - Press: a pulse.
 * - Ring wave (while he speaks): each ring in turn glows and swells a little, a wave running down.
 * - Gaze: when you send a prompt, the sphere turns its eye (the centre of the crossing rings)
 *   to face you, smoothly, and holds it while he thinks; it lets go as he answers.
 * - Claude: while ORION has handed the work to Claude, the gold deepens to a darker orange.
 *
 * API (unchanged for app.js): onSelect, setTools, toolEvent, select, setState,
 * setLevel, talk, paused.
 */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const AMBER = 40, CORAL = 9, DEEP = 26;   // gold, needs-you coral, and the deeper orange of Claude
const LEVELS = 10;                            // brightness buckets

/** What each state asks of the sphere. Everything eases toward these. */
const LOOK = {
  //            turn  flowA  flowB  swing  scan  light  swell
  idle:        [0.16, 0.00,  0.00,  0.00,  0.0,  0.78,  0.00],
  thinking:    [0.45, 0.90, -0.65,  0.55,  1.0,  1.00,  0.02],
  working:     [0.85, 1.70, -1.30,  1.00,  1.0,  1.05,  0.03],
  speaking:    [0.28, 0.25,  0.00,  0.10,  0.0,  0.92,  0.00],
  listening:   [0.20, 0.00,  0.00,  0.00,  0.0,  0.85,  0.00],
  'needs-you': [0.14, 0.00,  0.00,  0.00,  0.0,  0.90,  0.00],
  error:       [0.14, 0.00,  0.00,  0.00,  0.0,  0.85,  0.00],
  sleeping:    [0.05, 0.00,  0.00,  0.00,  0.0,  0.42,  -0.03],
};
const KEYS = ['turn', 'flowA', 'flowB', 'swing', 'scan', 'light', 'swell'];

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Rotate v about unit axis k by angle a (Rodrigues). */
function rot(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = (k[0] * v[0] + k[1] * v[1] + k[2] * v[2]) * (1 - c), x = cross(k, v);
  return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d];
}
function basis(n) {
  const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(n, a));
  return [u, cross(n, u)];
}

const AXIS_A = norm([0.18, 1, 0.05]);         // near-horizontal rings
const AXIS_B0 = norm([1, 0.42, -0.25]);       // the crossing family, ~70° away

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
    this.last = performance.now();
    this.t = 0;
    this.yaw = 0.6;                           // the sphere's turn
    this.offA = 0; this.offB = 0;             // ring flow, in rings
    this.swingAt = 0;                         // family B's axis, swung round A
    this.scanT = 0;
    this.level = 0; this.lvl = 0;
    this.ripples = [];
    this.hue = AMBER;
    this.retro = false;                       // scanlines and flicker for the corner sprite
    this.claude = false;                      // ORION has handed this turn to Claude
    this.deep = 0;                            // eased 0–1 toward that deeper orange
    this.wave = 0; this.waveT = 0;            // the ring wave
    this.gaze = 0; this.gazeOn = false; this.gazeFrom = 0;   // looking at you
    this.p = Object.fromEntries(KEYS.map((k, i) => [k, LOOK.idle[i]]));

    new ResizeObserver(() => this.#resize()).observe(host);
    this.#resize();
    this.cv.addEventListener('pointermove', (e) => {
      const inside = this.#inside(e);
      this.hover = inside;
      this.cv.style.cursor = inside ? 'pointer' : '';
      this.cv.title = inside ? 'ORION' : '';
    });
    this.cv.addEventListener('pointerleave', () => { this.hover = false; this.cv.style.cursor = ''; });
    this.cv.addEventListener('pointerdown', (e) => { if (this.#inside(e)) this.#ripple(1); });
    this.cv.addEventListener('click', (e) => { if (this.#inside(e)) this.onSelect?.('leo'); });
    requestAnimationFrame((n) => this.#frame(n));
  }

  /* ---------- API ---------- */

  setTools() {}                               // the sphere is ORION himself, not his tools

  /** A tool call sends a pulse of light through the rings. */
  toolEvent(e) { if (e.phase === 'call') this.#ripple(0.7); }

  select(id) { this.selected = id; }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.host.dataset.state = state;
  }

  /** A prompt went in: turn the eye to face the user. */
  look() { this.gazeOn = true; this.gazeFrom = this.t; }

  /** Whether ORION is working through Claude right now. */
  setClaude(on) { this.claude = !!on; }

  /** ORION's voice level, 0–1 (or the mic while listening). */
  setLevel(v) { this.level = clamp(v || 0, 0, 1); }

  /** A burst of speech: call it as each piece of a reply streams in. */
  talk(strength = 1) {
    const lastAt = this.ripples.at(-1)?.at ?? -9;
    if (this.t - lastAt > 0.22) this.#ripple(clamp(0.45 + 0.5 * strength, 0, 1));
  }

  #ripple(amp) { this.ripples.push({ at: this.t, amp }); if (this.ripples.length > 6) this.ripples.shift(); }

  /* ---------- motion ---------- */

  #frame(now) {
    const dt = clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    requestAnimationFrame((n) => this.#frame(n));
    if (this.paused || !this.W) return;
    this.t += dt;
    const look = LOOK[this.state] ?? LOOK.idle;
    const k = 1 - Math.exp(-dt / 0.4);        // every parameter eases the same way
    KEYS.forEach((key, i) => { this.p[key] += (look[i] - this.p[key]) * k; });
    this.lvl += (this.level - this.lvl) * (1 - Math.exp(-dt / 0.07));
    const alarm = this.state === 'needs-you' || this.state === 'error';
    const hueT = alarm ? CORAL : this.claude ? DEEP : AMBER;
    this.hue += (hueT - this.hue) * (1 - Math.exp(-dt / 0.6));       // a slow fade, not a switch
    this.deep += ((this.claude && !alarm ? 1 : 0) - this.deep) * (1 - Math.exp(-dt / 0.6));
    this.wave += ((this.state === 'speaking' ? 1 : 0) - this.wave) * (1 - Math.exp(-dt / 0.35));
    // hold the gaze at least a moment, and while he thinks; let go once he answers (or after 30 s)
    const held = this.t - this.gazeFrom;
    if (this.gazeOn && held > 1.4 && !['thinking', 'working'].includes(this.state)) this.gazeOn = false;
    if (this.gazeOn && held > 30) this.gazeOn = false;
    this.gaze += ((this.gazeOn ? 1 : 0) - this.gaze) * (1 - Math.exp(-dt / (this.gazeOn ? 0.32 : 0.7)));
    if (!reduced.matches) {
      this.yaw += dt * this.p.turn;
      this.offA += dt * this.p.flowA;
      this.offB += dt * this.p.flowB;
      this.swingAt += dt * this.p.swing;
      this.scanT += dt * 2.2 * this.p.scan;
      this.waveT += dt * 4.2;
    }
    this.ripples = this.ripples.filter((r) => this.t - r.at < 1.2);
    this.#draw();
  }

  /* ---------- drawing ---------- */

  #resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = this.host.clientWidth, H = this.host.clientHeight;
    if (!W || !H) return;
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.cv.style.width = `${W}px`; this.cv.style.height = `${H}px`;
    // fewer rings, fewer segments when the sphere is small
    const m = Math.min(W, H);
    this.rings = m < 90 ? 7 : m < 200 ? 13 : 19;
    this.segs = m < 90 ? 36 : 72;
    this.trig = Array.from({ length: this.segs + 1 }, (_, i) => [Math.cos((i / this.segs) * TAU), Math.sin((i / this.segs) * TAU)]);
  }

  #geom() {
    const R = (Math.min(this.W, this.H) / 2) * (this.retro ? 0.8 : 0.84) * (1 + this.p.swell + this.lvl * (this.state === 'speaking' ? 0.05 : 0));
    return { cx: this.W / 2, cy: this.H / 2, R };
  }

  #inside(e) {
    if (!this.W) return false;
    const r = this.cv.getBoundingClientRect();
    const { cx, cy, R } = this.#geom();
    return Math.hypot(e.clientX - r.left - cx, e.clientY - r.top - cy) <= R * 1.05;
  }

  /** How bright ring `d` (its plane's offset, -1..1) of a family is right now. */
  #ringLight(d, fam) {
    const p = this.p, t = this.t, s = this.state;
    let b = p.light + (this.hover || this.selected === 'leo' ? 0.08 : 0);
    if (s === 'needs-you' || s === 'error') b *= 0.72 + 0.28 * Math.sin(t * 2.6);
    if (s === 'speaking') b *= 1 + this.lvl * 0.5;
    if (s === 'listening' && fam === 0) b *= 1 + this.lvl * 1.4 * Math.exp(-(d * d) / 0.18);
    // the scan line sweeping across the crossing family while he thinks
    if (fam === 1 && p.scan > 0.01) { const f = Math.sin(this.scanT) * 0.85, q = (d - f) / 0.2; b *= 1 + 1.3 * p.scan * Math.exp(-q * q); }
    // pulses running top to bottom
    if (fam === 0) for (const r of this.ripples) {
      const age = this.t - r.at, f = 1.15 - age * 2.6, q = (d - f) / 0.17;
      b *= 1 + 1.6 * r.amp * Math.exp(-q * q) * (1 - age / 1.2);
    }
    return b;
  }

  /** The ring wave: 0–1 for ring `d` of a family, a band of light running down the sphere. */
  #ringWave(d, fam) {
    if (this.wave < 0.01) return 0;
    const s = Math.sin(this.waveT - d * (fam ? 2.2 : 3.4));
    return this.wave * (fam ? 0.45 : 1) * Math.pow(Math.max(0, s), 6);
  }

  #draw() {
    const { ctx, W, H, dpr } = this;
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { cx, cy, R } = this.#geom();
    if (R < 2) return;
    const p = this.p;
    const busy = clamp(p.scan, 0, 1);

    // a faint body of light inside the sphere
    const body = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R * 1.15);
    body.addColorStop(0, `hsla(${this.hue},80%,55%,${(0.07 + 0.07 * busy + 0.06 * this.lvl).toFixed(3)})`);
    body.addColorStop(1, `hsla(${this.hue},80%,40%,0)`);
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, W, H);

    // the view: turn about the vertical, then tip toward us
    const cyw = Math.cos(this.yaw), syw = Math.sin(this.yaw);
    const TILT = -0.38, ct = Math.cos(TILT), st = Math.sin(TILT);
    const view = (x, y, z) => {
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      return [x1, y * ct - z1 * st, y * st + z1 * ct];
    };

    const buckets = Array.from({ length: LEVELS }, () => new Path2D());
    const axisB = rot(AXIS_B0, AXIS_A, Math.sin(this.swingAt) * 0.9 + this.swingAt * 0.25);
    const fams = [[AXIS_A, this.offA], [axisB, this.offB]];
    const N = this.rings, S = this.segs, trig = this.trig;

    // the gaze: a turn that brings the eye (family B's axis, whichever end is nearer) round to face us
    let gk = null, ga = 0;
    const g = this.gaze * this.gaze * (3 - 2 * this.gaze);
    if (g > 0.001) {
      let b = view(axisB[0], axisB[1], axisB[2]);
      if (b[2] < 0) b = [-b[0], -b[1], -b[2]];
      const ang = Math.acos(clamp(b[2], -1, 1));
      if (ang > 1e-3) { gk = norm(cross(b, [0, 0, 1])); ga = ang * g; }
      this.eye = gk ? rot(b, gk, ga) : b;    // where the eye points now ([0,0,1] = straight at you)
    } else this.eye = null;

    fams.forEach(([n, off], fam) => {
      const [u, v] = basis(n);
      for (let i = 0; i < N; i++) {
        const slot = (((i + off) % N) + N) % N;
        const d = -1 + ((slot + 0.5) * 2) / N;
        const r = Math.sqrt(Math.max(0, 1 - d * d));
        if (r < 0.04) continue;
        const wv = this.#ringWave(d, fam);
        const ring = this.#ringLight(d, fam) * (1 + 1.4 * wv);
        const grow = 1 + 0.07 * wv;          // the lit ring swells out a little
        let px = 0, py = 0, pz = 0, lastQ = -1;
        for (let k = 0; k <= S; k++) {
          const [c, s] = trig[k];
          const wx = n[0] * d + r * (u[0] * c + v[0] * s);
          const wy = n[1] * d + r * (u[1] * c + v[1] * s);
          const wz = n[2] * d + r * (u[2] * c + v[2] * s);
          let [x, y, z] = view(wx * grow, wy * grow, wz * grow);
          if (gk) [x, y, z] = rot([x, y, z], gk, ga);
          const f = 1 + z * 0.07;            // a touch of perspective
          const sx = cx + x * R * f, sy = cy - y * R * f;
          if (k > 0) {
            const zm = (z + pz) / 2;
            const depth = 0.12 + 0.88 * Math.pow((zm + 1) / 2, 1.8);
            const a = clamp(depth * ring, 0, 1.6) / 1.6;
            const q = Math.min(LEVELS - 1, Math.floor(a * LEVELS));
            if (q > 0) {
              if (q !== lastQ) buckets[q].moveTo(px, py);
              buckets[q].lineTo(sx, sy);
              lastQ = q;
            } else lastQ = -1;
          }
          px = sx; py = sy; pz = z;
        }
      }
    });

    // light, added together: a wide halo, a glow, then the filament
    const w = Math.max(0.8, R * 0.015);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const passes = R > 40
      ? [[w * 5.5, 0.06, 46], [w * 2.4, 0.2, 56], [w, 0.8, 72], [w * 0.4, 0.5, 92]]
      : [[w * 2.6, 0.14, 55], [w, 0.8, 74]];
    // retro: coral glow round a cream filament, like phosphor on an old tube
    const flick = this.retro && !reduced.matches ? 0.94 + 0.06 * Math.sin(this.t * 47) * Math.sin(this.t * 13) : 1;
    for (const [lw, alpha, L] of passes) {
      ctx.lineWidth = lw;
      const core = L > 70;
      const hue = this.hue;
      const sat = (core ? 70 : 88) + 12 * this.deep;
      const lum = L - (core ? 12 : 8) * this.deep;
      for (let q = 1; q < LEVELS; q++) {
        const a = ((q + 0.5) / LEVELS) * 1.6 * alpha * flick;
        ctx.strokeStyle = `hsla(${hue.toFixed(1)},${sat}%,${lum}%,${clamp(a, 0, 1).toFixed(3)})`;
        ctx.stroke(buckets[q]);
      }
    }
    // scanlines cut through the light
    if (this.retro) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
