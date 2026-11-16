/*
 * ORION's network.
 *
 * ORION is the hub in the middle. Each tool is a gold node joined to him by a
 * tapered beam of light; each tool's skills are pearl nodes, and its recent
 * calls are the small cream (done) and amber (fresh) dots around it.
 *
 * When ORION calls a tool, its beam brightens and light runs along it: out to
 * the tool while the request goes ("call"), back to ORION while the answer
 * returns ("result"). The tool flares, and a new call dot lands beside it.
 *
 * Pan by dragging, zoom with the wheel, pinch or the toolbar. Every visual
 * quantity and the camera ride critically damped springs, so changes morph
 * and can be redirected mid-motion.
 */

const TAU = Math.PI * 2;
const FONT = '"Geist", system-ui, -apple-system, sans-serif';
const MONO = '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export const SKILLS = {
  memory: ['Notes', 'Facts'], planner: ['Tasks', 'Reminders'], web: ['Search', 'Read pages'],
  files: ['Downloads', 'Briefs'], voice: ['Whisper', 'Kokoro'], shopify: ['Orders', 'Products'],
  meta: ['Insights', 'Ads'], gelato: ['Print queue', 'Shipping'],
};
export const GROUPS = {
  memory: 'Core', planner: 'Core', web: 'Research', files: 'ORION machine',
  voice: 'Voice', shopify: 'Ciel ops', meta: 'Ciel ops', gelato: 'Ciel ops',
};

const STATE_FX = {
  idle:        { glow: 0.55, think: 0, alert: 0, dim: 0, spin: 1 },
  listening:   { glow: 0.8, think: 0, alert: 0, dim: 0, spin: 0.5 },
  thinking:    { glow: 0.9, think: 1, alert: 0, dim: 0, spin: 1.8 },
  working:     { glow: 1, think: 0.5, alert: 0, dim: 0, spin: 1.4 },
  speaking:    { glow: 0.95, think: 0, alert: 0, dim: 0, spin: 1 },
  'needs-you': { glow: 0.9, think: 0, alert: 1, dim: 0, spin: 1 },
  sleeping:    { glow: 0.2, think: 0, alert: 0, dim: 0.7, spin: 0.2 },
  error:       { glow: 0.2, think: 0, alert: 0, dim: 0.5, spin: 0 },
};

class Spring {
  constructor(v, response = 0.45) { this.x = v; this.v = 0; this.target = v; this.w = TAU / response; }
  step(dt) {
    const a = -this.w * this.w * (this.x - this.target) - 2 * this.w * this.v;
    this.v += a * dt; this.x += this.v * dt;
    return this.x;
  }
  snap(v) { this.x = this.target = v; this.v = 0; }
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const polar = (x, y, a, d) => [x + Math.cos(a) * d, y + Math.sin(a) * d];

/* Pre-rendered soft glows: far cheaper than shadowBlur every frame. */
const sprites = new Map();
function glow(rgb) {
  if (sprites.has(rgb)) return sprites.get(rgb);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, `rgba(${rgb},1)`);
  grd.addColorStop(0.18, `rgba(${rgb},0.55)`);
  grd.addColorStop(0.45, `rgba(${rgb},0.16)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  sprites.set(rgb, c);
  return c;
}
function blit(ctx, rgb, x, y, size, alpha) {
  if (alpha <= 0.004 || size <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glow(rgb), x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

function sphere(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.05, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
const ROSE = [[0, '#fff6dc'], [0.3, '#f2d896'], [0.72, '#b98a3a'], [1, '#3d2a0c']];   // tools: glossy gold
const LILAC = [[0, '#ffffff'], [0.35, '#ece7dc'], [0.75, '#a8a29a'], [1, '#3a3732']];  // skills: pearl
const TEAL = [[0, '#fffaf0'], [0.4, '#e9dcc2'], [0.82, '#9c8f78'], [1, '#2c271f']];   // calls: cream
const AMBER = [[0, '#fff4d6'], [0.4, '#f3c870'], [0.82, '#b07b25'], [1, '#3e2a0c']];
const HUB = [[0, '#fffbf1'], [0.3, '#f3e4c0'], [0.72, '#c9a467'], [1, '#5c431c']];

/**
 * ORION's orb: a glossy cream-gold sphere wrapped in a fringe of fine strands.
 * The strands breathe at rest, spin up while he thinks, and ripple with his
 * voice (`level`). Shared by the network hub and the flow view.
 */
export function drawHub(ctx, x, y, r, t, fx = {}) {
  const { glow: gl = 0.6, think = 0, alert = 0, dim = 0, spin = 1, level = 0, still = false, halo = 1 } = fx;
  const tt = still ? 0 : t;
  blit(ctx, '236,217,174', x, y, r * 9 * halo, 0.22 + gl * 0.35);
  blit(ctx, '214,170,90', x, y, r * 14 * halo, 0.05 + gl * 0.06);

  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(236,217,174,${0.1 + gl * 0.08})`;
  ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, TAU); ctx.stroke();

  // the fringe
  const N = 150;
  ctx.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + tt * 0.06 * spin;
    const wobble = 0.5 + 0.5 * Math.sin(i * 1.7 + tt * 1.3) * Math.sin(i * 0.43 - tt * 0.7);
    const voice = level * (0.4 + 0.6 * Math.abs(Math.sin(i * 0.9 + tt * 9)));
    const len = r * (0.16 + 0.22 * wobble + 0.75 * voice + 0.1 * think * Math.abs(Math.sin(i * 0.31 + tt * 4)));
    const r0 = r * 1.16;
    const teal = i % 3 === 0;   // every third strand a deeper gold
    ctx.strokeStyle = teal ? `rgba(214,170,90,${0.38 + gl * 0.25})` : `rgba(240,224,186,${0.42 + gl * 0.3})`;
    ctx.lineWidth = teal ? 0.8 : 1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len));
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(245,232,200,${0.55 + gl * 0.3})`;
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, TAU); ctx.stroke();

  sphere(ctx, x, y, r, HUB);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.32, r * 0.18, -0.6, 0, TAU); ctx.fill();

  if (think > 0.02) {
    ctx.strokeStyle = `rgba(245,232,200,${0.7 * think})`;
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const a = tt * 2.4 + (k * TAU) / 3;
      ctx.beginPath(); ctx.arc(x, y, r * 1.85, a, a + 0.6); ctx.stroke();
    }
  }
  if (alert > 0.02) {
    const p = (tt * 0.8) % 1;
    ctx.strokeStyle = `rgba(224,128,111,${alert * (1 - p) * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r * (1.3 + p * 1.6), 0, TAU); ctx.stroke();
  }
  if (dim > 0.02) {
    ctx.fillStyle = `rgba(10,10,10,${dim * 0.55})`;
    ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, TAU); ctx.fill();
  }
}

export class LeoGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.edges = [];
    this.byId = new Map();
    this.calls = new Map();      // live call id -> { tool, phase, born }
    this.pulses = [];            // finished-call sparkles
    this.state = 'idle';
    this.fx = Object.fromEntries(Object.entries(STATE_FX.idle).map(([k, v]) => [k, new Spring(v, 0.6)]));
    this.level = new Spring(0, 0.12);
    this.statePill = 'idle';
    this.selected = 'leo';
    this.hover = null;
    this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
    this.cam = { x: new Spring(0, 0.4), y: new Spring(0, 0.4), s: new Spring(1, 0.4) };
    this.userMoved = false;
    this.onSelect = () => {};
    this.onHover = () => {};
    this.paused = false;
    this.stretch = 1.35;
    // line mode: while chatting, the network pours into a column on the left
    this.line = new Spring(0, 0.95);
    this.lineBox = { x: 140, top: 120, bottom: 600 };
    this.squash = 0.72;
    this.t = 0;
    this.#bind();
    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
    this.last = performance.now();
    requestAnimationFrame((n) => this.#frame(n));
  }

  /* ---------------- data ---------------- */

  setTools(tools) {
    this.nodes = []; this.edges = []; this.byId.clear();
    const add = (n) => { n.drift = Math.random() * TAU; this.nodes.push(n); this.byId.set(n.id, n); return n; };
    add({ id: 'leo', kind: 'hub', x: 0, y: 0, r: 26, name: 'ORION', order: 0 });
    const N = tools.length;
    const radii = [300, 360, 320, 385, 305, 370, 330, 350, 340, 315];
    tools.forEach((tool, i) => {
      const rand = rng(i * 977 + 13);
      const a = -Math.PI / 2 + (i / N) * TAU + (rand() - 0.5) * 0.22;
      // a wide ellipse: screens are wider than they are tall
      const [x, y] = polar(0, 0, a, radii[i % radii.length]).map((v, j) => v * (j ? this.squash : this.stretch));
      const node = add({ id: tool.id, kind: 'tool', x, y, r: 13, a, name: tool.name, tool, count: tool.calls ?? 0, heat: new Spring(0, 0.5), flare: new Spring(0, 0.35), order: i + 1 });
      this.edges.push({ kind: 'beam', from: 'leo', to: tool.id, warm: i % 3 !== 1 });
      const skills = SKILLS[tool.id] ?? ['Skill', 'Skill'];
      skills.forEach((name, k) => {
        const sa = a + (k ? 0.5 : -0.48) + (rand() - 0.5) * 0.25;
        const [sx, sy] = polar(x, y, sa, 88 + rand() * 30);
        const sk = add({ id: `${tool.id}:s${k}`, kind: 'skill', x: sx, y: sy, r: 8.5, a: sa, name, parent: tool.id, order: i + 1 });
        this.edges.push({ kind: 'thin', from: tool.id, to: sk.id });
        if (rand() < 0.55) this.edges.push({ kind: 'faint', from: 'leo', to: sk.id });
        for (let j = 0; j < 2; j++) {
          const la = sa + (j ? 0.55 : -0.5) + (rand() - 0.5) * 0.4;
          const [lx, ly] = polar(sx, sy, la, 38 + rand() * 26);
          const lf = add({ id: `${sk.id}:l${j}`, kind: 'leaf', x: lx, y: ly, r: 3.4, amber: rand() < 0.35, n: 1 + Math.floor(rand() * 30), parent: tool.id, pop: new Spring(0, 0.3), order: i + 1 });
          this.edges.push({ kind: 'thin', from: sk.id, to: lf.id, dotted: true });
        }
      });
      for (let j = 0; j < 3; j++) {
        const la = a + (j - 1) * 0.9 + Math.PI * (rand() < 0.3 ? 1 : 0) * 0.5 + (rand() - 0.5) * 0.3;
        const [lx, ly] = polar(x, y, la, 46 + rand() * 30);
        const lf = add({ id: `${tool.id}:l${j}`, kind: 'leaf', x: lx, y: ly, r: 3.4, amber: rand() < 0.3, n: 1 + Math.floor(rand() * 30), parent: tool.id, pop: new Spring(0, 0.3), order: i + 1 });
        this.edges.push({ kind: 'thin', from: tool.id, to: lf.id, dotted: rand() < 0.5 });
      }
    });
    this.bounds = this.nodes.reduce((b, n) => ({
      x0: Math.min(b.x0, n.x - 60), x1: Math.max(b.x1, n.x + 150), y0: Math.min(b.y0, n.y - 40), y1: Math.max(b.y1, n.y + 40),
    }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
    if (!this.userMoved) this.fit(true);
  }

  setCounts(tools) {
    tools.forEach((t) => { const n = this.byId.get(t.id); if (n) n.count = t.calls; });
  }

  setState(state, pill) {
    this.state = state;
    if (pill) this.statePill = pill;
    const p = STATE_FX[state] ?? STATE_FX.idle;
    for (const k in p) this.fx[k].target = p[k];
  }

  setLevel(v) { this.level.target = clamp(v, 0, 1); }

  /** Pour the network into a vertical column (chat) or back out into the map. */
  setLine(on, box) {
    if (box) this.lineBox = { ...this.lineBox, ...box };
    this.line.target = on ? 1 : 0;
  }
  get lined() { return this.line.target === 1; }

  /** A tool call from the client: { call, tool, phase: 'call' | 'result' | 'done' }. */
  toolEvent({ call, tool, phase }) {
    const node = this.byId.get(tool);
    if (!node) return;
    if (phase === 'done') {
      if (this.calls.has(call)) {
        this.calls.delete(call);
        this.pulses.push({ tool, born: this.t });
        const leaves = this.nodes.filter((n) => n.kind === 'leaf' && n.parent === tool);
        const lf = leaves[Math.floor(Math.random() * leaves.length)];
        if (lf) { lf.n++; lf.amber = true; lf.pop.x = 1; lf.pop.target = 0; lf.fresh = this.t; }
      }
    } else {
      if (!this.calls.has(call)) { node.count++; node.flare.x = 1; }
      this.calls.set(call, { tool, phase, born: this.t });
    }
  }

  /* ---------------- camera ---------------- */

  setInsets(ins) {
    this.insets = { ...this.insets, ...ins };
    if (!this.userMoved) this.fit();
  }

  fit(instant = false) {
    if (!this.bounds) return;
    const { W, H } = this;
    const { top, right, bottom, left } = this.insets;
    const aw = Math.max(80, W - left - right), ah = Math.max(80, H - top - bottom);
    const bw = this.bounds.x1 - this.bounds.x0, bh = this.bounds.y1 - this.bounds.y0;
    const s = clamp(Math.min(aw / bw, ah / bh) * 0.96, 0.22, 1.6);
    const cx = (this.bounds.x0 + this.bounds.x1) / 2, cy = (this.bounds.y0 + this.bounds.y1) / 2;
    const set = (sp, v) => (instant ? sp.snap(v) : (sp.target = v));
    set(this.cam.s, s); set(this.cam.x, cx); set(this.cam.y, cy);
    this.userMoved = false;
  }

  zoomBy(f, px, py) {
    const { W, H } = this;
    px ??= this.#viewCenter()[0]; py ??= this.#viewCenter()[1];
    const s0 = this.cam.s.target, s1 = clamp(s0 * f, 0.2, 3);
    const [wx, wy] = this.#toWorld(px, py, s0);
    // keep the world point under the cursor where it is
    const [vcx, vcy] = this.#viewCenter();
    this.cam.s.target = s1;
    this.cam.x.target = wx - (px - vcx) / s1;
    this.cam.y.target = wy - (py - vcy) / s1;
    this.userMoved = true;
    void W; void H;
  }

  select(id) {
    this.selected = id;
  }

  /** Screen position of a node, for anchoring UI to it. */
  screenOf(id) {
    const n = this.byId.get(id);
    return n ? this.#pos(n) : null;
  }

  #viewCenter() {
    const { top, right, bottom, left } = this.insets;
    return [left + (this.W - left - right) / 2, top + (this.H - top - bottom) / 2];
  }
  #toScreen(x, y, s = this.cam.s.x) {
    const [vcx, vcy] = this.#viewCenter();
    return [vcx + (x - this.cam.x.x) * s, vcy + (y - this.cam.y.x) * s];
  }
  #toWorld(px, py, s = this.cam.s.x) {
    const [vcx, vcy] = this.#viewCenter();
    return [this.cam.x.target + (px - vcx) / s, this.cam.y.target + (py - vcy) / s];
  }

  #resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    if (!this.userMoved) this.fit(true);
  }

  /* ---------------- input ---------------- */

  hit(px, py) {
    const s = this.cam.s.x;
    let best = null, bestD = Infinity;
    for (const n of this.nodes) {
      if (n.kind === 'leaf' || (n.kind === 'skill' && this.line.x > 0.4)) continue;
      const [x, y] = this.#pos(n);
      const d = Math.hypot(px - x, py - y);
      const reach = Math.max(16, n.r * s * (n.kind === 'hub' ? 1.8 : 1.4) + 8);
      if (d < reach && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  #bind() {
    const cv = this.canvas;
    const pts = new Map();
    let drag = null, pinch = null;
    const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      if (pts.size === 1) {
        const [x, y] = local(e);
        drag = { x, y, cx: this.cam.x.x, cy: this.cam.y.x, moved: false, locked: this.lined };
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: this.cam.s.target };
        drag = null;
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const [x, y] = local(e);
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [x, y]);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const f = (pinch.s * (d / pinch.d)) / this.cam.s.target;
        this.zoomBy(f, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        return;
      }
      if (drag) {
        const dx = x - drag.x, dy = y - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; cv.classList.add('grabbing'); }
        if (drag.moved && !drag.locked) {
          const s = this.cam.s.x;
          this.cam.x.snap(drag.cx - dx / s); this.cam.y.snap(drag.cy - dy / s);
          this.userMoved = true;
        }
        return;
      }
      if (e.pointerType === 'mouse') {
        const n = this.hit(x, y);
        const id = n ? n.id : null;
        if (id !== this.hover) { this.hover = id; this.onHover(n, x, y); }
        cv.style.cursor = n ? 'pointer' : this.lined ? 'default' : 'grab';
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (drag && !drag.moved && e.type === 'pointerup') {
        const [x, y] = local(e);
        const n = this.hit(x, y);
        const target = n ? (n.kind === 'skill' ? n.parent : n.id) : null;
        this.onSelect(target, n);
      }
      drag = null;
      cv.classList.remove('grabbing');
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { if (this.hover) { this.hover = null; this.onHover(null); } });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.lined) return;
      const [x, y] = local(e);
      const k = e.ctrlKey ? 0.012 : 0.0016;
      this.zoomBy(Math.exp(-e.deltaY * k), x, y);
    }, { passive: false });
  }

  /* ---------------- drawing ---------------- */

  #frame(now) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    if (!this.paused && this.W > 0 && this.nodes.length) {
      this.t += dt;
      this.#step(dt);
      this.#draw();
    }
    requestAnimationFrame((n) => this.#frame(n));
  }

  #step(dt) {
    for (const k in this.fx) this.fx[k].step(dt);
    this.level.step(dt);
    this.line.step(dt);
    if (Math.abs(this.line.x - this.line.target) < 0.0005 && Math.abs(this.line.v) < 0.001) this.line.snap(this.line.target);
    this.cam.x.step(dt); this.cam.y.step(dt); this.cam.s.step(dt);
    const hot = new Set([...this.calls.values()].map((c) => c.tool));
    for (const n of this.nodes) {
      if (n.kind === 'tool') { n.heat.target = hot.has(n.id) ? 1 : 0; n.heat.step(dt); n.flare.target = 0; n.flare.step(dt); }
      if (n.kind === 'leaf') n.pop.step(dt);
    }
    this.pulses = this.pulses.filter((p) => this.t - p.born < 2.6);
  }

  #mapPos(n) {
    if (reduced.matches || n.kind === 'hub') return this.#toScreen(n.x, n.y);
    const amp = n.kind === 'leaf' ? 3 : n.kind === 'skill' ? 2.2 : 1.4;
    return this.#toScreen(n.x + Math.sin(this.t * 0.35 + n.drift) * amp, n.y + Math.cos(this.t * 0.29 + n.drift * 1.3) * amp);
  }

  /** Where a node sits in the column: ORION on top, tools evenly below him. */
  #linePos(n) {
    const { x, top, bottom } = this.lineBox;
    const tools = this.nodes.length ? this.nodes.filter((m) => m.kind === 'tool').length : 1;
    if (n.kind === 'hub') return [x, top + 26];
    const y0 = top + 112, y1 = Math.max(y0 + 40, bottom - 20);
    const i = (n.order ?? 1) - 1;
    const y = y0 + (tools > 1 ? (i / (tools - 1)) * (y1 - y0) : 0);
    return [x, y];
  }

  /** How far one node has travelled into the column (staggered, eased). */
  #mixOf(n) {
    const m = this.line.x;
    if (m <= 0.0005) return 0;
    if (m >= 0.9995) return 1;
    const N = 9, d = 0.035;
    const t = clamp((m - (n.order ?? 0) * d) / (1 - N * d), 0, 1);
    return t * t * (3 - 2 * t);
  }

  #pos(n) {
    const a = this.#mapPos(n);
    const e = reduced.matches ? Math.round(this.line.x) : this.#mixOf(n);
    if (e <= 0) return a;
    const b = this.#linePos(n);
    if (e >= 1) return b;
    // travel on a gentle arc, not a straight slide
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const bend = Math.sin(Math.PI * e) * 0.16;
    return [a[0] + dx * e - dy * bend, a[1] + dy * e + dx * bend];
  }

  /** 1 where a node is fully in the map, 0 once it has folded into the column. */
  #mapness(n) {
    const owner = n.parent ? this.byId.get(n.parent) : n;
    return 1 - (owner ? this.#mixOf(owner) : this.line.x);
  }

  #draw() {
    const { ctx, W, H, dpr } = this;
    const s = this.cam.s.x;
    const t = reduced.matches ? 0 : this.t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const P = new Map(this.nodes.map((n) => [n.id, this.#pos(n)]));
    if (!P.has('leo')) return;
    const k0 = clamp(0.5 + s * 0.5, W < 600 ? 0.52 : 0.62, 1.5);   // node size factor: shrinks slower than the map
    const L = this.line.x;
    const k = k0 + (0.8 - k0) * L;
    const focus = this.selected && this.selected !== 'leo' ? this.selected : null;
    const dimOf = (toolId) => (focus && toolId !== focus ? 0.45 : 1);

    // thin structure lines
    ctx.lineCap = 'round';
    for (const e of this.edges) {
      if (e.kind === 'beam') continue;
      const [x0, y0] = P.get(e.from), [x1, y1] = P.get(e.to);
      const toolId = this.byId.get(e.to).parent ?? e.to;
      const a = ((e.kind === 'faint' ? 0.1 : 0.24) * dimOf(toolId) + (this.byId.get(toolId)?.heat?.x ?? 0) * 0.25) * this.#mapness(this.byId.get(e.to));
      if (a < 0.004) continue;
      ctx.strokeStyle = e.kind === 'faint' ? `rgba(200,170,120,${a})` : `rgba(236,226,206,${a})`;
      ctx.lineWidth = e.kind === 'faint' ? 0.7 : 0.85;
      ctx.setLineDash(e.dotted ? [1.5, 3] : []);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.setLineDash([]);

    // beams of light from ORION to each tool
    ctx.globalCompositeOperation = 'lighter';
    const [hx, hy] = P.get('leo');
    for (const e of this.edges) {
      if (e.kind !== 'beam') continue;
      const n = this.byId.get(e.to);
      const [x1, y1] = P.get(e.to);
      const heat = n.heat.x, d = dimOf(n.id);
      const dx = x1 - hx, dy = y1 - hy, L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      const sx = hx + ux * 38 * k, sy = hy + uy * 38 * k;
      const ex = x1 - ux * (n.r + 4) * k, ey = y1 - uy * (n.r + 4) * k;
      const rgb = e.warm || heat > 0.1 ? '247,228,190' : '214,176,110';
      const beam = (w0, w1, a0, a1) => {
        const g = ctx.createLinearGradient(sx, sy, ex, ey);
        g.addColorStop(0, `rgba(${rgb},${a0})`);
        g.addColorStop(1, `rgba(${rgb},${a1})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx + nx * w0, sy + ny * w0);
        ctx.lineTo(ex + nx * w1, ey + ny * w1);
        ctx.lineTo(ex - nx * w1, ey - ny * w1);
        ctx.lineTo(sx - nx * w0, sy - ny * w0);
        ctx.closePath(); ctx.fill();
      };
      const base = (e.warm ? 0.5 : 0.32) * d;
      beam((14 + heat * 10) * k, 3 * k, (0.12 + heat * 0.22) * d, 0.02);           // haze
      beam((4.6 + heat * 3) * k, 0.8 * k, base + heat * 0.45, 0.1 + heat * 0.3);    // core
      beam(1.4 * k, 0.4 * k, (0.55 + heat * 0.45) * d, 0.12 + heat * 0.4);        // hot filament

      // light running along the beam while a call is live
      if (heat > 0.05) {
        const live = [...this.calls.values()].filter((c) => c.tool === n.id);
        const inbound = live.some((c) => c.phase === 'result');
        for (let i = 0; i < 7; i++) {
          let p = (i / 7 + this.t * 0.55) % 1;
          if (inbound) p = 1 - p;
          const px = sx + (ex - sx) * p, py = sy + (ey - sy) * p;
          const tail = 14 * k * (inbound ? -1 : 1);
          const col = inbound ? '255,226,160' : '255,244,220';
          ctx.strokeStyle = `rgba(${col},${0.85 * heat})`;
          ctx.lineWidth = 1.6 * k;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - ux * tail, py - uy * tail); ctx.stroke();
          blit(ctx, col, px, py, 12 * k, 0.6 * heat);
        }
      }
    }

    // finished calls: a cool sparkle around the tool, like light settling
    for (const p of this.pulses) {
      const n = this.byId.get(p.tool);
      const [x, y] = P.get(p.tool);
      const age = (this.t - p.born) / 2.6;
      const a = (1 - age) * (1 - age);
      blit(ctx, '240,200,120', x, y, (60 + age * 50) * k, 0.55 * a);
      for (let i = 0; i < 6; i++) {
        const ang = i * 1.05 + p.born;
        const [sx2, sy2] = polar(x, y, ang, (24 + age * 46 + (i % 3) * 8) * k);
        blit(ctx, '255,236,190', sx2, sy2, 14 * k, 0.8 * a);
      }
      void n;
    }
    ctx.globalCompositeOperation = 'source-over';

    // leaves (calls)
    for (const n of this.nodes) {
      if (n.kind !== 'leaf') continue;
      const [x, y] = P.get(n.id);
      const d = dimOf(n.parent) * this.#mapness(n);
      if (d < 0.01) continue;
      const r = Math.max(0.5, n.r * k * (1 + n.pop.x * 1.2));
      ctx.globalAlpha = d;
      if (n.pop.x > 0.02) { ctx.globalCompositeOperation = 'lighter'; blit(ctx, '243,200,112', x, y, r * 10, n.pop.x); ctx.globalCompositeOperation = 'source-over'; }
      sphere(ctx, x, y, r, n.amber ? AMBER : TEAL);
      if (s > 0.42) {
        ctx.font = `500 ${clamp(9 * k, 8, 11)}px ${MONO}`;
        ctx.fillStyle = `rgba(236,230,218,${0.62 * d})`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(n.n), x + r + 2, y - r - 1);
      }
      ctx.globalAlpha = 1;
    }

    // skills
    for (const n of this.nodes) {
      if (n.kind !== 'skill') continue;
      const [x, y] = P.get(n.id);
      const d = dimOf(n.parent) * this.#mapness(n), heat = this.byId.get(n.parent).heat.x;
      if (d < 0.01) continue;
      const r = n.r * k;
      ctx.globalAlpha = d;
      ctx.globalCompositeOperation = 'lighter';
      blit(ctx, '236,230,218', x, y, r * 6, 0.22 + heat * 0.35);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(236,228,210,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r + 3 * k, 0, TAU); ctx.stroke();
      sphere(ctx, x, y, r, LILAC);
      if (this.hover === n.id) this.#tag(x + r + 7, y + 4, n.name, 11);
      ctx.globalAlpha = 1;
    }

    // tools
    for (const n of this.nodes) {
      if (n.kind !== 'tool') continue;
      const [x, y] = P.get(n.id);
      const d = dimOf(n.id), heat = n.heat.x, flare = n.flare.x;
      const r = n.r * k * (1 + heat * 0.12);
      ctx.globalAlpha = Math.max(d, heat);
      ctx.globalCompositeOperation = 'lighter';
      blit(ctx, '226,180,96', x, y, r * 7, 0.25 + heat * 0.35);
      if (heat > 0.02 || flare > 0.02) {
        const f = Math.max(heat * (0.75 + 0.25 * Math.sin(this.t * 6)), flare);
        blit(ctx, '255,250,240', x, y, r * (9 + f * 8), 0.75 * f);
        ctx.strokeStyle = `rgba(255,248,235,${0.45 * f})`; ctx.lineWidth = 1;
        const L = r * (3 + f * 3);
        ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L * 0.6); ctx.lineTo(x, y + L * 0.6); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r + 7 * k, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(246,222,170,${0.55 + heat * 0.4})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, r + 3.5 * k, 0, TAU); ctx.stroke();
      sphere(ctx, x, y, r, ROSE);
      if (this.selected === n.id || this.hover === n.id) this.#ring(x, y, r + 11 * k, this.selected === n.id ? 1 : 0.5);
      // label + count pill
      const fs = clamp(13 * k, 11, 16);
      ctx.font = `500 ${fs}px ${FONT}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = `rgba(246,242,234,${0.95 * Math.max(d, heat)})`;
      const lx = x + r + 10 * k;
      ctx.fillText(n.name, lx, y - 1);
      this.#pill(lx, y + 5, String(n.count), 'calls', heat);
      ctx.globalAlpha = 1;
    }

    // ORION
    const fx = Object.fromEntries(Object.entries(this.fx).map(([kk, v]) => [kk, v.x]));
    const hr = 30 * k;
    drawHub(ctx, hx, hy, hr, this.t, { ...fx, level: this.level.x, still: reduced.matches, halo: 1 - L * 0.45 });
    if (this.selected === 'leo' || this.hover === 'leo') this.#ring(hx, hy, hr * 2.25, this.hover === 'leo' && this.selected !== 'leo' ? 0.5 : 0.35);
    ctx.font = `600 ${clamp(17 * k, 13, 20)}px ${FONT}`;
    ctx.fillStyle = 'rgba(246,248,247,0.98)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const lx = hx + hr * 1.75;
    ctx.fillText('ORION', lx, hy - 2);
    this.#pill(lx, hy + 5, this.statePill, '', 0);
    void t;
  }

  #ring(x, y, r, a) {
    const { ctx } = this;
    ctx.strokeStyle = `rgba(245,230,195,${0.85 * a})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([2, 5]);
    ctx.lineDashOffset = reduced.matches ? 0 : -this.t * 8;
    ctx.strokeStyle = `rgba(245,230,195,${0.4 * a})`;
    ctx.beginPath(); ctx.arc(x, y, r + 6, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }

  #pill(x, y, text, unit, heat) {
    const { ctx } = this;
    ctx.font = `500 10px ${MONO}`;
    const tw = ctx.measureText(text).width;
    ctx.font = `400 8.5px ${MONO}`;
    const uw = unit ? ctx.measureText(unit).width + 3 : 0;
    const w = tw + uw + 12, h = 16;
    ctx.fillStyle = heat > 0.1 ? `rgba(60,48,26,${0.75 + heat * 0.2})` : 'rgba(12,12,12,0.74)';
    ctx.strokeStyle = heat > 0.1 ? `rgba(245,220,170,${0.3 + heat * 0.4})` : 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = `500 10px ${MONO}`;
    ctx.fillStyle = 'rgba(238,242,240,0.92)';
    ctx.fillText(text, x + 6, y + h / 2 + 0.5);
    if (unit) {
      ctx.font = `400 8.5px ${MONO}`;
      ctx.fillStyle = 'rgba(180,172,160,0.85)';
      ctx.fillText(unit, x + 6 + tw + 3, y + h / 2 + 0.5);
    }
    ctx.textBaseline = 'alphabetic';
  }

  #tag(x, y, text, size) {
    const { ctx } = this;
    ctx.font = `500 ${size}px ${FONT}`;
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(18,17,16,0.88)';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.roundRect(x, y - 16, w, 20, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(246,242,234,0.95)';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 6, y - 6);
    ctx.textBaseline = 'alphabetic';
  }
}
