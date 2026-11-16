/**
 * Orbit: ORION as one flat circle inside a set of thick concentric bands,
 * one band per tool. Nothing orbits.
 *
 * Everything is flat: no gradients, no glow.
 * - At rest everything is still: a gold disc and quiet, dark bands.
 * - A tool in use: its band turns solid gold, and fades back when done.
 * - ORION talking (his voice level, or reply text streaming in via `talk()`):
 *   one soft ripple runs outward through the bands, then they settle.
 * - Thinking: the disc breathes, nothing else.
 *
 * Hover a band for its tool's name (a tooltip); tap it (or the disc) to select.
 */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/** Critically damped follower, so every change eases. */
class Ease {
  constructor(v = 0, response = 0.5) { this.x = v; this.v = 0; this.target = v; this.w = TAU / response; }
  step(dt) {
    const d = this.x - this.target;
    this.v += (-this.w * this.w * d - 2 * this.w * this.v) * dt;
    this.x += this.v * dt;
  }
  get moving() { return Math.abs(this.x - this.target) > 1e-3 || Math.abs(this.v) > 1e-3; }
}

const CORE = 0.17;            // disc radius, as a share of the space's radius
const IN = 0.29, OUT = 0.98;  // where the bands start and end
const FILL = 0.56;            // share of each band's pitch that's band (the rest is gap)

export class Orbit {
  /** @param {HTMLElement} host */
  constructor(host) {
    this.host = host;
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('role', 'img');
    this.cv.setAttribute('aria-label', 'ORION and his tools');
    host.append(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.onSelect = null;
    this.bands = [];
    this.selected = null;
    this.hover = null;
    this.state = 'idle';
    this.level = new Ease(0, 0.14);
    this.talkE = new Ease(0, 0.22);
    this.talkT = 0;
    this.breath = new Ease(0, 0.8);
    this.t = 0;
    this.last = performance.now();
    this.paused = false;
    this.dirty = true;
    new ResizeObserver(() => this.#resize()).observe(host);
    this.#resize();
    this.cv.addEventListener('pointermove', (e) => this.#hoverAt(e));
    this.cv.addEventListener('pointerleave', () => { this.hover = null; this.cv.style.cursor = ''; this.dirty = true; });
    this.cv.addEventListener('click', (e) => { const hit = this.#hit(e); if (hit) this.onSelect?.(hit); });
    requestAnimationFrame((n) => this.#frame(n));
  }

  setTools(tools) {
    this.bands = tools.map((t) => ({ id: t.id, name: t.name, calls: 0, heat: new Ease(0, 0.7), flash: new Ease(0, 0.35) }));
    this.dirty = true;
  }

  /** @param {{ tool: string, phase: 'call'|'done'|string }} e */
  toolEvent(e) {
    const b = this.bands.find((x) => x.id === e.tool);
    if (!b) return;
    if (e.phase === 'call') { b.calls++; b.flash.x = 1; b.flash.target = 0; }
    else if (e.phase === 'done' || e.phase === 'error') b.calls = Math.max(0, b.calls - 1);
    b.heat.target = b.calls > 0 ? 1 : 0;
    if (reduced.matches) b.heat.x = b.heat.target;
    this.dirty = true;
  }

  /** Mark the selected tool (or 'leo' / null for none). */
  select(id) { this.selected = id; this.dirty = true; }

  setState(state) {
    this.state = state;
    this.host.dataset.state = state;
    this.breath.target = state === 'thinking' || state === 'working' ? 1 : 0;
    this.dirty = true;
  }

  /** ORION's voice level, 0–1 (or the mic while listening). */
  setLevel(v) { this.level.target = clamp(v, 0, 1); }

  /** A burst of speech energy: call it as each piece of a reply streams in. */
  talk(strength = 1) {
    this.talkT = clamp(this.talkT * 0.45 + (0.4 + Math.random() * 0.4) * strength, 0, 1);
  }

  #energy() { return reduced.matches ? 0 : clamp(this.level.x * 0.9 + this.talkE.x * 0.75, 0, 1.1); }

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
    const R = Math.min(this.W, this.H) / 2;
    const n = Math.max(1, this.bands.length);
    const pitch = ((OUT - IN) * R) / n;
    return { cx: this.W / 2, cy: this.H / 2, R, pitch, th: pitch * FILL };
  }

  #hit(e) {
    if (!this.W) return null;
    const r = this.cv.getBoundingClientRect();
    const { cx, cy, R, pitch } = this.#geom();
    const d = Math.hypot(e.clientX - r.left - cx, e.clientY - r.top - cy);
    if (d <= CORE * R * 1.15) return 'leo';
    const k = Math.round((d - IN * R - pitch * FILL * 0.5) / pitch);   // nearest band centre
    return k >= 0 && k < this.bands.length ? this.bands[k].id : null;
  }

  #hoverAt(e) {
    const h = this.#hit(e);
    if (h !== this.hover) {
      this.hover = h; this.dirty = true;
      this.cv.title = h === 'leo' ? 'ORION' : this.bands.find((b) => b.id === h)?.name ?? '';
    }
    this.cv.style.cursor = h ? 'pointer' : '';
  }

  #frame(now) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    if (!this.paused && this.W) {
      this.t += dt;
      this.talkT *= Math.exp(-dt * 3.2);                  // each burst dies away like a syllable
      this.talkE.target = this.talkT;
      const eases = [this.level, this.talkE, this.breath, ...this.bands.flatMap((b) => [b.heat, b.flash])];
      let moving = false;
      for (const e of eases) { e.step(dt); moving ||= e.moving; }
      if (moving || this.dirty || this.#energy() > 0.002 || this.breath.x > 0.01) this.#draw();
    }
    requestAnimationFrame((n) => this.#frame(n));
  }

  #draw() {
    const { ctx, W, H, dpr } = this;
    if (!W) return;
    this.dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { cx, cy, R, pitch, th } = this.#geom();
    const E = this.#energy();
    const t = this.t;

    // the bands: flat rings. Dark at rest, solid gold while their tool works.
    // When he talks, one soft ripple runs outward through them.
    ctx.lineWidth = th;
    this.bands.forEach((b, i) => {
      const r = IN * R + pitch * (i + FILL / 2) + E * pitch * 0.2 * Math.sin(t * 4.6 - i * 0.8);
      const on = clamp(Math.max(b.heat.x, b.flash.x * 0.7), 0, 1);
      const lift = (this.hover === b.id ? 0.05 : 0) + (this.selected === b.id ? 0.09 : 0);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
      ctx.strokeStyle = `rgba(239,226,196,${(0.06 + lift).toFixed(3)})`;
      ctx.stroke();
      if (on > 0.005) {
        ctx.strokeStyle = `rgba(214,180,106,${(0.9 * on).toFixed(3)})`;
        ctx.stroke();
      }
    });

    // the disc: one flat gold circle, breathing a little while he thinks
    const breathe = this.breath.x * (0.5 + 0.5 * Math.sin(t * 3.4));
    const cr = CORE * R * (1 + E * 0.05 + breathe * 0.03);
    ctx.fillStyle = '#e4cb94';
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
    const ring = this.state === 'needs-you' ? 'rgba(224,128,111,0.75)' : this.hover === 'leo' || this.selected === 'leo' ? 'rgba(244,240,232,0.45)' : null;
    if (ring) {
      ctx.strokeStyle = ring; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, cr + 5, 0, TAU); ctx.stroke();
    }
  }
}
