/**
 * The ORION wordmark: clean geometric letters, each drawn as a few fine gold
 * threads that run together, drift a hair apart and cross again. Pure math,
 * so it renders in the browser and in Node (tools/make_logo.mjs writes the
 * static SVGs in icons/ from it).
 */

const line = (x0, y0, x1, y1) => [x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + (2 * (x1 - x0)) / 3, y0 + (2 * (y1 - y0)) / 3, x1, y1];
const K = 0.5523;
/** A ring drawn a touch past full circle, from the top, so the ends overlap. */
const ring = (cx, cy, r) => [[cx, cy - r], [
  [cx + r * K, cy - r, cx + r, cy - r * K, cx + r, cy],
  [cx + r, cy + r * K, cx + r * K, cy + r, cx, cy + r],
  [cx - r * K, cy + r, cx - r, cy + r * K, cx - r, cy],
  [cx - r, cy - r * K, cx - r * K, cy - r, cx, cy - r],
  [cx + r * 0.2, cy - r, cx + r * 0.38, cy - r * 0.97, cx + r * 0.52, cy - r * 0.9],
]];

// Cap height 100, from y 20 to 120.
const STROKES = [
  ring(60, 70, 50),                                                       // O
  [[140, 120], [line(140, 120, 140, 20), line(140, 20, 176, 20),          // R: stem + bowl
    [200, 20, 214, 34, 214, 49], [214, 64, 200, 78, 176, 78], line(176, 78, 140, 78)]],
  [[174, 78], [line(174, 78, 216, 120)]],                                 // R: leg
  [[252, 20], [line(252, 20, 252, 120)]],                                 // I
  ring(342, 70, 50),                                                      // O
  [[424, 120], [line(424, 120, 424, 20), line(424, 20, 504, 120), line(504, 120, 504, 20)]], // N
];

const GOLDS = ['#e7c983', '#b8863a', '#f6ead0', '#d6aa5a'];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Points along a stroke with normals and running length. */
function sample([[x0, y0], segs], per = 28) {
  const out = [];
  let px = x0, py = y0, len = 0, last = null;
  for (const [c1x, c1y, c2x, c2y, x, y] of segs) {
    for (let i = last ? 1 : 0; i <= per; i++) {
      const t = i / per, u = 1 - t;
      const X = u * u * u * px + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x;
      const Y = u * u * u * py + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y;
      let dx = 3 * u * u * (c1x - px) + 6 * u * t * (c2x - c1x) + 3 * t * t * (x - c2x);
      let dy = 3 * u * u * (c1y - py) + 6 * u * t * (c2y - c1y) + 3 * t * t * (y - c2y);
      const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
      if (last) len += Math.hypot(X - last[0], Y - last[1]);
      last = [X, Y];
      out.push({ x: X, y: Y, nx: -dy, ny: dx, s: len });
    }
    px = x; py = y;
  }
  return out;
}

/**
 * @param {{ strands?: number, spread?: number, seed?: number, width?: number, animate?: boolean, title?: string }} o
 * @returns {string} an <svg> string
 */
export function orionLogo({ strands = 3, spread = 1, seed = 7, width = 1.4, animate = false, title = 'ORION' } = {}) {
  const paths = threadPaths({ strands, spread, seed, width, animate }).flat();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 10 524 120" role="img" aria-label="${title}" class="orion-mark${animate ? ' draw' : ''}"><title>${title}</title><g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g></svg>`;
}

// which strokes make each letter, and each letter's box in logo units (cap height 100, y 20..120)
const LETTERS = [
  { strokes: [0], x0: 10, x1: 110 },
  { strokes: [1, 2], x0: 140, x1: 216 },
  { strokes: [3], x0: 252, x1: 252 },
  { strokes: [4], x0: 292, x1: 392 },
  { strokes: [5], x0: 424, x1: 504 },
];
export const LOGO_BOX = { x0: 10, x1: 504, y0: 20, y1: 120, vb: [0, 10, 524, 120] };

/**
 * The logo split into its five letters, each its own <svg> sharing the logo's
 * coordinates, so they can move apart and close back up into the exact logo.
 * Each comes with its box and the gap to the next letter, in logo units.
 */
export function orionLetters(opts = {}) {
  const per = threadPaths({ strands: 3, spread: 1, seed: 7, width: 1.4, ...opts });
  const pad = 4;
  return LETTERS.map((L, i) => ({
    x0: L.x0 - pad, x1: L.x1 + pad,
    gap: i < LETTERS.length - 1 ? LETTERS[i + 1].x0 - L.x1 - 2 * pad : 0,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${L.x0 - pad} ${20 - pad} ${L.x1 - L.x0 + 2 * pad} ${100 + 2 * pad}" aria-hidden="true" class="orion-mark${opts.animate ? ' draw' : ''}"><g fill="none" stroke-linecap="round" stroke-linejoin="round">${L.strokes.map((s) => per[s].join('')).join('')}</g></svg>`,
  }));
}

/** Thread paths for every stroke: an array (per stroke) of <path> strings. */
function threadPaths({ strands = 3, spread = 1, seed = 7, width = 1.4, animate = false }) {
  const rand = rng(seed);
  const threads = Array.from({ length: strands }, (_, i) => ({
    a: (1.4 + rand() * 1.6) * spread, f: 0.018 + rand() * 0.016, p: rand() * 6.28,
    b: (strands > 1 ? i / (strands - 1) - 0.5 : 0) * 1.6 * spread,
    color: GOLDS[i % GOLDS.length],
    o: 0.75 + rand() * 0.25,
  }));
  return STROKES.map((stroke, si) => {
    const pts = sample(stroke);
    const total = pts.at(-1).s || 1;
    return threads.map((t, ti) => {
      const d = pts.map((p, i) => {
        // threads meet at each stroke's ends and part through the middle
        const env = Math.sin(Math.PI * (p.s / total)) ** 0.8;
        const off = (t.b + t.a * Math.sin(p.s * t.f + t.p + si * 1.7)) * (0.35 + 0.65 * env);
        return `${i ? 'L' : 'M'}${(p.x + p.nx * off).toFixed(1)} ${(p.y + p.ny * off).toFixed(1)}`;
      }).join('');
      const delay = animate ? ` style="--d:${(si * 0.12 + ti * 0.06).toFixed(2)}s"` : '';
      return `<path d="${d}" stroke="${t.color}" stroke-width="${width}" stroke-opacity="${t.o.toFixed(2)}" pathLength="1"${delay}/>`;
    });
  });
}
