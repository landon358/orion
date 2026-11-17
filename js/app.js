import { createLeoClient } from './leo-client.js';
import { groupOf, skillsOf, describe } from './tools.js';
import { mountBusiness } from './business.js';
import { mountAdmin } from './admin.js';
import { setBackdrop } from './backdrop.js';
import { orionLogo } from './logo.js';
import { playIntro } from './intro.js';
import { Orbit } from './orbit.js';
import { mountLab } from './lab.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (t) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};
const agoLong = (t) => (ago(t) === 'now' ? 'just now' : `${ago(t)} ago`);
const haptic = (ms = 8) => { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms); };
const project = (v, d = 0.998) => ((v / 1000) * d) / (1 - d);
const rubber = (o, dim, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));
const svg = (d, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${d}</svg>`;

const ICON = {
  leo: svg('<rect x="5" y="5" width="14" height="14" rx="4"/><path d="M12 1.8v3.2M12 19v3.2M1.8 12H5M19 12h3.2"/><circle cx="12" cy="12" r="2"/>'),
  memory: svg('<path d="M12 6.5a3 3 0 0 0-5.6-1.4A3 3 0 0 0 4.6 10 3 3 0 0 0 5 15.6a3 3 0 0 0 4 3.3A3 3 0 0 0 12 18Z"/><path d="M12 6.5a3 3 0 0 1 5.6-1.4 3 3 0 0 1 1.8 4.9 3 3 0 0 1-.4 5.6 3 3 0 0 1-4 3.3A3 3 0 0 1 12 18"/>'),
  planner: svg('<rect x="5" y="4" width="14" height="16" rx="2.5"/><path d="M9 9h6M9 12.5h6M9 16h3"/>'),
  web: svg('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.6 2.8 2.6 13.2 0 16M12 4c-2.6 2.8-2.6 13.2 0 16"/>'),
  files: svg('<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z"/>'),
  voice: svg('<path d="M3.5 12H5M7.5 8.5v7M11 5.5v13M14.5 9v6M18 11v2"/>'),
  shopify: svg('<path d="M5.5 8.5h13l-1.2 11h-10.6Z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>'),
  meta: svg('<path d="M4 14.5v-5l11-4.5v14Z"/><path d="M7.5 15.5 9 20h3l-1.2-3.8M18 9.5a3 3 0 0 1 0 5"/>'),
  gelato: svg('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 13.5h10V20H7Z"/>'),
  email: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>'),
  clarity: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/><path d="M12 9v1M15 12h-1"/>'),
  github: svg('<circle cx="6.5" cy="5.5" r="2"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="8.5" r="2"/><path d="M6.5 7.5v9M17.5 10.5c0 4-11 2.5-11 6"/>'),
  printer: svg('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 13.5h10V20H7Z"/><path d="M16.5 11.5h.01"/>'),
  orders: svg('<path d="M5.5 8.5h13l-1.2 11h-10.6Z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>'),
  revenue: svg('<path d="M12 3.5v17M16 7.5c-.8-1.2-2.2-1.8-4-1.8-2.3 0-3.8 1.1-3.8 2.8 0 4 7.8 2 7.8 6.2 0 1.7-1.6 2.9-4 2.9-1.9 0-3.4-.7-4.2-2"/>'),
  target: svg('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r=".6"/>'),
  bolt: svg('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z"/>'),
  tasks: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 2.5 2.5L16 9"/>'),
  bell: svg('<path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 4 1.3 5.5 2 6.5h-15c.7-1 2-2.5 2-6.5Z"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>'),
  chip: svg('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>'),
  timer: svg('<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2 1.5M10 3h4"/>'),
  skills: svg('<circle cx="7" cy="12" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M9.3 11 14.7 8M9.3 13l5.4 3"/>'),
  play: svg('<circle cx="12" cy="12" r="8"/><path d="m10.5 9 4.5 3-4.5 3Z"/>'),
  done: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  check: svg('<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
  rejected: svg('<path d="M7 7l10 10M17 7 7 17"/>'),
  network: svg('<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="5" r="1.6"/><circle cx="19" cy="6" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="18" r="1.6"/><path d="M6.2 6.2 10 10M17.8 7.2 14 10.4M6.2 17.8 10 14M17.8 16.8 14 13.6"/>'),
  notes: svg('<path d="M3 17.5 8 11l4 3 5-7"/><path d="M18.5 3v4M16.5 5h4"/>'),
  arrow: svg('<path d="M8 16 16 8M9.5 8H16v6.5"/>'),
  chev: svg('<path d="m9 6 6 6-6 6"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  allClear: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>'),
  tool: svg('<path d="M14.5 6.5a4 4 0 0 0 5 5l-8 8a2.1 2.1 0 0 1-3-3l8-8a4 4 0 0 1-2-2Z"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>'),
  think: svg('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'),
  approval: svg('<path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 4 1.3 5.5 2 6.5h-15c.7-1 2-2.5 2-6.5Z"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
  trendUp: svg('<path d="M1 8l4-4 3 3 5-5M9 2h4v4"/>', '0 0 14 10'),
  trendDown: svg('<path d="M1 2l4 4 3-3 5 5M13 4v4H9"/>', '0 0 14 10'),
};

const ACTIVE = new Set(['thinking', 'working', 'speaking', 'listening']);
const UNDO_MS = 5000;
const EXPLORE = { shopify: 'business', meta: 'business', clarity: 'business', gelato: 'business', planner: 'tasks' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const client = createLeoClient();

/* ---------- who's logged in: the owner sees everything, other accounts only chat ---------- */
// The mock and a token login with no account info behave as the owner.
const account = () => client.account ?? null;
const canAct = () => account()?.features?.actions !== false;
/** The master view: the owner only (features.admin); the mock and a bare token login count as the owner. */
const canAdmin = () => (account() ? account().features?.admin === true || (account().role === 'owner' && account().features?.admin !== false) : canAct());
/** How ORION addresses this person: their `address` ("sir", "Commander"), else their name. */
const address = () => account()?.address || (canAct() ? 'sir' : account()?.name) || 'sir';
function applyAccount() {
  body.classList.toggle('guest', !canAct());
  body.classList.toggle('no-admin', !canAdmin());
  if ((!canAct() && ui.route === 'business') || (!canAdmin() && ui.route === 'admin')) go('home');
}
const body = document.body;
const root = document.documentElement;
const wideMQ = matchMedia('(min-width: 900px)');
const roomyMQ = matchMedia('(min-width: 1181px)');
const isWide = () => wideMQ.matches;
const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';

const ui = {
  messages: new Map(),
  knownApprovals: new Set(),
  decisions: new Map(),
  expanded: new Set(),
  turn: null,
  lastLeo: null,
  selected: 'leo',
  detailOpen: false,
  popOpen: false,
  drawerOpen: false,
  panel: 'tasks',
  convoOpen: true,
  state: 'idle', stateLabel: 'Standing by', stateDetail: '',
  gpuHistory: Array(32).fill(6),
  tpsHistory: Array(60).fill(0),
  hourly: new Map(),        // tool -> calls per hour, last 24h
  callStart: new Map(),     // call id -> start time
  callTimes: new Map(),     // tool -> durations (ms)
  liveCalls: new Map(),     // call id -> tool
  activeStat: 'tasks',
  route: null,
  flyFrom: null,
  sessionCalls: 0,
  lastJob: Date.now() - 6 * 60e3,
};
// the phone's orbit: ORION's core, a ring, his tools
const orbit = new Orbit($('#orbit'));

/* ================================================================ */
/* layout                                                           */
/* ================================================================ */

function layout() {
  const dockH = $('#dock').offsetHeight;
  root.style.setProperty('--dock-h', `${dockH}px`);
  const topH = $('#topbar').offsetHeight;
  if (isWide()) {
    const right = ui.detailOpen ? 400 : 0;
    let box;
    let side = false;
    if (ui.route === 'chat') {
      // the open space left of the conversation, under the rail: ORION there, his state beneath
      // the chat box's left edge, where its slide ends (not mid-animation)
      const avail = innerWidth - 88 - right;
      const dockL = 88 + avail / 2 - Math.min(720, avail - 48) / 2;
      const railB = $('.rail').getBoundingClientRect().bottom || topH + 340;
      const dockB = innerHeight - 18;                                 // the chat box's bottom edge
      const LABEL = 34;                                                // the status line under the sphere
      const size = Math.round(Math.min(190, dockL * 0.62, dockB - railB - 28 - LABEL));
      if (size >= 120 && dockL >= 240) {                               // room for the panel and its full status line
        side = true;
        const cx = dockL / 2, top = dockB - LABEL - size;              // centred between the wall and the chat box, down at the bottom
        box = { left: cx - size / 2, top, width: size, height: size };
        root.style.setProperty('--ms-x', `${Math.round(cx)}px`);
        root.style.setProperty('--ms-y', `${Math.round(top + size - 1)}px`);
        root.style.setProperty('--ms-w', `${size}px`);
        root.style.setProperty('--ms-max', `${Math.round(dockL - 32)}px`);   // never reaches the chat box
      } else {
        // too narrow for that: a small instrument at the head of the column, its state beside it
        const cx = (88 + innerWidth - right) / 2, sz = 52;
        box = { left: cx - sz / 2, top: topH + 2, width: sz, height: sz };
        root.style.setProperty('--ms-x', `${Math.round(cx + sz / 2 + 12)}px`);
        root.style.setProperty('--ms-y', `${Math.round(topH + 2 + sz / 2)}px`);
      }
    } else {
      // ORION page: centred in the window, between the top bar and the composer
      const free = innerHeight - topH - (dockH + 40);
      const size = Math.max(160, Math.min(400, free * 0.7, (innerWidth - right) * 0.42));
      box = { left: (innerWidth - right - size) / 2, top: topH + (free - size) / 2, width: size, height: size };
    }
    Object.assign($('#orbit').style, { left: `${box.left}px`, top: `${box.top}px`, width: `${Math.max(0, box.width)}px`, height: `${Math.max(0, box.height)}px` });
    body.classList.toggle('orb-side', side);
    orbit.retro = side;
  } else {
    body.classList.remove('orb-side');
    $('#orbit').removeAttribute('style');
  }
  placeSummary();
}
new ResizeObserver(layout).observe($('#dock'));
addEventListener('resize', layout);
wideMQ.addEventListener('change', () => { setDetail(ui.detailOpen && isWide()); applyRoute(); });

/* ================================================================ */
/* client events                                                    */
/* ================================================================ */

client.on('connection', ({ status, mode }) => {
  const c = $('#conn');
  c.className = `conn ${status}`;
  c.setAttribute('aria-label', status === 'online' ? `Connected${mode === 'mock' ? ', demo data' : ''}` : status === 'connecting' ? 'Connecting' : 'Offline');
  if (status === 'online') {
    applyAccount();
    renderCloud();
    const s = client.snapshot();
    orbit.setTools(s.tools);
    s.tools.forEach(seedHourly);
    welcome();
    renderStats(); renderDetail();
    askForBrief();
    renderSummary();
    setDetail(false);
    if (ui.route === 'business') biz.render();
    if (ui.route === 'admin') adm.open();
    layout();
  }
});

client.on('state', ({ state, label, detail }) => {
  ui.state = state; ui.stateLabel = label; ui.stateDetail = detail ?? '';
  orbit.setState(state);
  if (/claude/i.test(detail ?? '')) orbit.setClaude(true);
  else if (!ACTIVE.has(state)) orbit.setClaude(false);
  // just the word: no brain names or arguments
  $('#m-state').textContent = state === 'thinking' ? 'Thinking' : state === 'working' ? 'Calling' : label;
  $('#composer').classList.toggle('busy', ['thinking', 'working', 'speaking'].includes(state));
  if (ACTIVE.has(state)) ui.lastJob = Date.now();
  voice.onLeoState(state);
  if (ui.turn && state === 'thinking' && !ui.turn.steps.length) setWorking(label);
  if (ui.selected === 'leo') scheduleDetail();
});

client.on('audio', ({ amp }) => { orbit.setLevel(amp); voice.leoAmp = amp; });

client.on('tool', (e) => {
  orbit.toolEvent(e);
  const t = client.tools.find((x) => x.id === e.tool);
  if (e.phase === 'call') {
    ui.callStart.set(e.call, performance.now());
    ui.liveCalls.set(e.call, e.tool);
    ui.sessionCalls++;
    const h = ui.hourly.get(e.tool); if (h) h[h.length - 1]++;
    if (ui.turn && t) ui.turn.tools.add(t.name);
  }
  if (e.phase === 'done') {
    const st = ui.callStart.get(e.call);
    if (st) {
      const list = ui.callTimes.get(e.tool) ?? [];
      list.push(performance.now() - st); if (list.length > 20) list.shift();
      ui.callTimes.set(e.tool, list);
      ui.callStart.delete(e.call);
    }
    ui.liveCalls.delete(e.call);
  }
  if (e.tool === ui.selected) scheduleDetail();
});

client.on('message', (m) => (m.role === 'user' ? addUserMessage(m) : upsertLeoMessage(m)));

client.on('activity', (a) => {
  if (ui.turn && ['tool', 'search', 'think'].includes(a.kind)) { ui.turn.steps.push(a.title); setWorking(`${a.title}…`); }
  if (tasksOpen() && a.kind === 'think') renderTasks();
  if (ui.selected === 'leo' || a.tool === ui.selected) scheduleDetail();
});

client.on('task', () => {
  if (tasksOpen()) renderTasks();
  renderStats();
  if (ui.selected === 'leo') scheduleDetail();
});

client.on('approval', (a) => {
  if (a.status === 'pending' && !ui.knownApprovals.has(a.id)) { ui.knownApprovals.add(a.id); bumpBadge(); }
  updateBadge(); renderApprovals(); renderStats(); renderSummaryFlag();
  if (tasksOpen()) renderTasks();
});

client.on('metrics', () => {
  renderStats();
  if (ui.route === 'business') biz.refresh();
  if (['shopify', 'meta', 'gelato'].includes(ui.selected)) scheduleDetail();
});

client.on('vitals', (v) => {
  ui.tpsHistory.push(v.tps); ui.tpsHistory.shift();
  ui.gpuHistory.push(v.gpu); ui.gpuHistory.shift();
  renderStats();
  if (ui.selected === 'leo') scheduleDetail();
});

// ORION can replace the tool list mid-session (rare): keep the vitals list and an open tool detail current
client.on('tools', (tools) => {
  tools.forEach(seedHourly);
  orbit.setTools(tools);
  if (ui.selected !== 'leo' && !tools.some((t) => t.id === ui.selected)) setDetail(false);
  else scheduleDetail();
});

client.on('notify', (n) => showBanner(n));

/* ================================================================ */
/* graph: select a node to see it in the detail panel               */
/* ================================================================ */

orbit.onSelect = (id) => { select(id); haptic(6); };

function select(id, { open = true } = {}) {
  ui.selected = id;
  orbit.select(id);
  renderDetail();
  if (open) setDetail(true);
}

function setDetail(open) {
  ui.detailOpen = open;
  body.classList.toggle('detail-open', open);
  if (!isWide()) $('#scrim').classList.toggle('on', open || ui.drawerOpen);
  root.style.setProperty('--detail-drag', '0px');
  if (!open && ui.selected !== 'leo') { ui.selected = 'leo'; orbit.select(null); }
  layout();
}
$('#btn-detail-close').addEventListener('click', () => setDetail(false));

// Phone: drag the sheet down to dismiss, with momentum.
(() => {
  const grab = $('#detail-grab');
  const el = $('#detail');
  let y0 = 0, dy = 0, hist = [], dragging = false;
  grab.addEventListener('pointerdown', (e) => {
    dragging = true; y0 = e.clientY; dy = 0; hist = [[e.timeStamp, e.clientY]];
    grab.setPointerCapture(e.pointerId); el.classList.add('dragging');
  });
  grab.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const raw = e.clientY - y0;
    dy = raw < 0 ? rubber(raw, 200) : raw;
    root.style.setProperty('--detail-drag', `${dy}px`);
    hist.push([e.timeStamp, e.clientY]); if (hist.length > 5) hist.shift();
  });
  const end = () => {
    if (!dragging) return;
    dragging = false; el.classList.remove('dragging');
    const [t0, a] = hist[0], [t1, b] = hist.at(-1);
    const v = t1 > t0 ? ((b - a) / (t1 - t0)) * 1000 : 0;
    if (dy + project(v) > el.offsetHeight * 0.35) setDetail(false);
    else root.style.setProperty('--detail-drag', '0px');
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
})();

/* ================================================================ */
/* detail panel                                                     */
/* ================================================================ */

let detailQueued = false;
function scheduleDetail() {
  if (detailQueued) return;
  detailQueued = true;
  setTimeout(() => { detailQueued = false; renderDetail(); }, 400);
}

function histo(values, { w = 150, h = 46, rows = 9 } = {}) {
  const n = values.length;
  const max = Math.max(...values, 1);
  const step = w / n, gap = h / rows;
  let dots = '';
  values.forEach((v, i) => {
    const k = Math.max(1, Math.round((v / max) * rows));
    for (let j = 0; j < k; j++) {
      const hot = v >= max * 0.7 && j >= k - 2;
      dots += `<circle cx="${(i * step + step / 2).toFixed(1)}" cy="${(h - j * gap - gap / 2).toFixed(1)}" r="1.25"${hot ? ' class="hot"' : ''}/>`;
    }
  });
  return `<svg class="histo" viewBox="0 0 ${w} ${h}" aria-hidden="true">${dots}</svg>`;
}

// Arrow shows direction; color shows whether that's good (lowerIsBetter flips it, e.g. cost per sale).
function delta(v, label, unit = '%', lowerIsBetter = false) {
  if (v == null || !isFinite(v)) return `<span class="delta"><b>—</b>${esc(label)}</span>`;
  const up = v >= 0;
  const good = up !== lowerIsBetter;
  return `<span class="delta"><b class="${good ? 'up' : 'down'}">${up ? '+' : '−'}${Math.abs(Math.round(v))}${unit}${up ? ICON.trendUp : ICON.trendDown}</b>${esc(label)}</span>`;
}

const cell = (icon, val, label, attrs = '') => `<${attrs ? 'button' : 'div'} class="cell" ${attrs}><div class="cell-top">${icon}<span class="cell-val">${val}</span></div><div class="cell-label">${label}</div></${attrs ? 'button' : 'div'}>`;

const uptime = (u) => `${Math.floor(u / 86400)}d ${Math.floor((u % 86400) / 3600)}h`;

function seedHourly(t) {
  if (ui.hourly.has(t.id)) return;
  // a live ORION has no per-hour history to send, so its counts start at zero; only the demo invents a past
  if (client.mode !== 'mock') return void ui.hourly.set(t.id, new Array(24).fill(0));
  let seed = [...t.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const hours = Array.from({ length: 24 }, (_, i) => {
    const day = Math.sin(((i - 6) / 24) * Math.PI * 2) * 0.5 + 0.5;
    return Math.round(rnd() * 3 * day + (rnd() < 0.2 ? rnd() * 4 : 0));
  });
  ui.hourly.set(t.id, hours);
}

function notesFor(id) {
  const acts = client.snapshot().activity.filter((a) => (id === 'leo' ? true : a.tool === id)).sort((a, b) => b.at - a.at).slice(0, 3);
  if (!acts.length) return `<div class="note empty">No calls yet this session. ORION will log them here as they happen.</div>`;
  return acts.map((a) => `<div class="note"><div class="note-t">${esc(a.title)}<span>${ago(a.at)}</span></div>${a.detail ? `<div class="note-d">${esc(a.detail)}</div>` : ''}</div>`).join('');
}

function renderDetail() {
  const el = $('#detail-body');
  const scroll = el.scrollTop;
  // keep a half-typed rule (the panel repaints on every bit of activity)
  const typing = el.contains(document.activeElement) && document.activeElement.id ? document.activeElement : null;
  const keep = typing && { id: typing.id, value: typing.value, a: typing.selectionStart, b: typing.selectionEnd };
  const draft = $('#rule-in', el)?.value;
  el.innerHTML = ui.selected === 'leo' ? leoDetail() : toolDetail(ui.selected);
  if (draft) { const r = $('#rule-in', el); if (r) r.value = draft; }
  if (keep) { const n = $(`#${keep.id}`, el); if (n) { n.value = keep.value; n.focus({ preventScroll: true }); n.setSelectionRange?.(keep.a, keep.b); } }
  el.scrollTop = scroll;
  const tool = client.tools.find((t) => t.id === ui.selected);
  $('#crumb-text').textContent = tool
    ? `${groupOf(tool.id)} · ${describe(tool).name} · ${tool.calls} calls today`
    : 'ORION overview';
}

function leoDetail() {
  const s = client.snapshot();
  const v = s.vitals;
  const running = s.tasks.filter((t) => t.status === 'running').length;
  const waiting = s.approvals.filter((a) => a.status === 'pending').length;
  const busy = ACTIVE.has(ui.state);
  const badge = ui.state === 'needs-you' ? 'alert' : busy ? '' : 'idle';
  const prev = ui.gpuHistory.slice(0, 16).reduce((a, b) => a + b, 0) / 16;
  return `
    <div class="d-kicker">${ICON.leo}<span>Agent · runs on your PC</span></div>
    <h2 class="d-title">ORION</h2>
    <div class="d-status">
      <div class="st-text"><span class="badge ${badge}">${esc(ui.stateLabel)}</span><br>Up <b>${uptime(v.uptime)}</b> · last job <b>${agoLong(ui.lastJob)}</b></div>
      <button class="explore" data-drawer="tasks">Tasks ${ICON.chev}</button>
    </div>
    <div class="metric cool">
      <div class="metric-head"><span>GPU load</span><span class="badge outline">${v.gpu > 60 ? 'Busy' : 'Cool'} · ${v.temp}°C</span></div>
      <div class="metric-body">
        <span class="metric-val">${v.gpu}<small>%</small></span>
        ${delta(v.gpu - prev, 'vs 30s avg', ' pts')}
        ${histo(ui.gpuHistory)}
      </div>
    </div>
    <div class="grid2">
      ${cell(ICON.play, running, 'Tasks running', 'data-drawer="tasks"')}
      ${cell(ICON.bell, waiting, 'Waiting on you', 'data-pop="1"')}
    </div>
    ${vitalsBlock(v)}
    ${rulesBlock()}
    ${canAct() ? filesBlock() : ''}
    <div class="notes-head">${ICON.notes}Recent work</div>
    ${notesFor('leo')}`;
}

/* Your rules: the "from now on…" instructions ORION keeps for this account (STYLE.md on the PC). */
const X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
function rulesBlock() {
  const items = client.style?.items;
  const list = items == null
    ? '<div class="note empty">Your rules appear here once ORION shares them.</div>'
    : items.length
      ? `<ul class="d-list">${items.map((r) => `<li${ui.ruleGoing?.has(r.id) ? ' class="going"' : ''}><span>${esc(r.text)}</span><button type="button" class="d-x" data-rule-x="${esc(r.id)}" aria-label="Remove rule: ${esc(r.text)}">${X_SVG}</button></li>`).join('')}</ul>`
      : '<div class="note empty">No rules yet. Tell ORION “from now on…”, or add one here.</div>';
  return `<div class="notes-head">${ICON.notes}Your rules</div>${list}
    <form class="d-add" data-rule-add><input id="rule-in" maxlength="200" placeholder="Add a rule, e.g. keep it short" aria-label="New rule" autocomplete="off"><button type="submit">Add</button></form>`;
}

/* Files ORION made: his workspace on the PC, newest first, each one downloadable. */
const KIB = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const FILE_KIND = { sheet: 'Sheet', image: 'Picture', pdf: 'PDF', doc: 'Doc', text: 'Text' };
function filesBlock() {
  const items = client.files?.items;
  let body;
  if (items == null) body = '<div class="note empty">Files ORION makes appear here once he shares them.</div>';
  else if (!items.length) body = '<div class="note empty">Nothing yet. Ask ORION for a spreadsheet, a chart or an export.</div>';
  else {
    const shown = ui.filesAll ? items : items.slice(0, 5);
    body = `<ul class="d-list files">${shown.map((f) => `<li><span><b>${esc(f.name)}</b><small>${esc(FILE_KIND[f.kind] ?? 'File')} · ${f.size != null ? KIB(f.size) : ''}${f.modified ? ` · ${ago(f.modified)}` : ''}</small></span><button type="button" class="d-x dl${ui.fileWant?.has(f.path) ? ' busy' : ''}" data-file-get="${esc(f.path)}" aria-label="Download ${esc(f.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg></button></li>`).join('')}</ul>
      ${items.length > 5 ? `<button type="button" class="d-more" data-files-all>${ui.filesAll ? 'Show fewer' : `Show all ${items.length}`}</button>` : ''}`;
  }
  return `<div class="notes-head">${ICON.notes}Files ORION made</div>${body}`;
}

function toolDetail(id) {
  const found = client.tools.find((x) => x.id === id);
  if (!found) return '';
  const t = describe(found);
  const live = [...ui.liveCalls.values()].includes(id);
  const times = ui.callTimes.get(id) ?? [];
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length / 1000 : null;
  const m = client.metrics;
  const k = m.kpis;
  const days = m.days;
  const sum = (arr, key) => arr.reduce((a, d) => a + d[key], 0);
  let metric;
  if (id === 'shopify') {
    const prev = sum(days.slice(0, 7), 'orders');
    metric = { label: 'Orders, 7 days', val: k.orders7d, unit: '', d: prev ? ((k.orders7d - prev) / prev) * 100 : null, dl: 'vs prior week', badge: m.sample ? 'Sample data' : 'Live', values: days.map((d) => d.orders), warm: true };
  } else if (id === 'meta') {
    metric = { label: 'Cost per sale', val: k.cpa7d ? `$${k.cpa7d.toFixed(0)}` : '—', unit: '', d: k.cpa7d ? ((k.cpa7d - 24) / 24) * 100 : null, dl: 'vs $24 average', lower: true, badge: k.cpa7d > 30 ? 'High' : 'Moderate', values: days.map((d) => d.spend), warm: true };
  } else if (id === 'gelato') {
    metric = { label: 'Prints ordered, 7 days', val: k.orders7d, unit: '', d: null, dl: 'one per order', badge: 'Sample data', values: days.map((d) => d.orders), warm: true };
  } else {
    const h = ui.hourly.get(id) ?? [];
    const today = h.slice(-12).reduce((a, b) => a + b, 0), before = h.slice(0, 12).reduce((a, b) => a + b, 0);
    metric = { label: 'Calls, last 12 hours', val: today, unit: '', d: before ? ((today - before) / before) * 100 : null, dl: 'vs the 12 before', badge: live ? 'Live' : 'Steady', values: h, warm: false };
  }
  return `
    <div class="d-kicker">${ICON[id] ?? ICON.tool}<span>${esc(groupOf(id))}</span></div>
    <h2 class="d-title">${esc(t.name)}</h2>
    <p class="d-sub">${esc(t.desc)}</p>
    <div class="d-status">
      <div class="st-text"><span class="badge ${live ? '' : 'idle'}">${live ? 'In use now' : 'Ready'}</span><br>Last called <b>${agoLong(t.lastUsed)}</b></div>
      <button class="explore" data-explore="${EXPLORE[id] ?? 'tasks'}">Explore details ${ICON.chev}</button>
    </div>
    <div class="metric ${metric.warm ? '' : 'cool'}">
      <div class="metric-head"><span>${metric.label}</span><span class="badge outline">${metric.badge}</span></div>
      <div class="metric-body">
        <span class="metric-val">${metric.val}</span>
        ${delta(metric.d, metric.dl, '%', metric.lower)}
        ${histo(metric.values)}
      </div>
    </div>
    <div class="grid2">
      ${cell(ICON.network, t.calls, 'Calls today')}
      ${cell(ICON.timer, avg ? `${avg.toFixed(1)}<small>s</small>` : '—', 'Average call time')}
      ${cell(ICON.clock, ago(t.lastUsed), 'Since last call')}
      ${cell(ICON.skills, skillsOf(id).length, esc(skillsOf(id).join(' and ')))}
    </div>
    <div class="notes-head">${ICON.notes}What ORION did with it</div>
    ${notesFor(id)}`;
}

ui.ruleGoing = new Set();
ui.fileWant = new Set();
ui.filesAll = false;
$('#detail-body').addEventListener('submit', (e) => {
  if (!e.target.matches('[data-rule-add]')) return;
  e.preventDefault();
  const inp = $('#rule-in', e.target);
  const text = inp.value.trim();
  if (!text) return;
  client.styleAdd(text);
  inp.value = '';
  haptic(6);
});
client.on('style', () => { ui.ruleGoing.clear(); if (ui.selected === 'leo') scheduleDetail(); });
client.on('files', () => { if (ui.selected === 'leo') scheduleDetail(); });
client.on('file', (f) => {
  if (!ui.fileWant.delete(f.path)) return;
  if (ui.selected === 'leo') scheduleDetail();
  if (f.error || !f.data) { showBanner({ id: `dl${Date.now()}`, title: 'Couldn’t download that', body: f.error ?? 'ORION sent nothing back.', target: {} }); return; }
  const bin = atob(f.data), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: f.mime || 'application/octet-stream' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: f.name || f.path.split('/').pop() });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});
$('#detail-body').addEventListener('click', (e) => {
  const rx = e.target.closest('[data-rule-x]');
  if (rx) { ui.ruleGoing.add(rx.dataset.ruleX); client.styleRemove(rx.dataset.ruleX); scheduleDetail(); haptic(6); return; }
  const fg = e.target.closest('[data-file-get]');
  if (fg) { ui.fileWant.add(fg.dataset.fileGet); client.fileGet(fg.dataset.fileGet); scheduleDetail(); haptic(6); return; }
  if (e.target.closest('[data-files-all]')) { ui.filesAll = !ui.filesAll; scheduleDetail(); return; }
  const row = e.target.closest('[data-tool]');
  if (row) { select(row.dataset.tool); haptic(6); return; }
  const x = e.target.closest('[data-explore],[data-drawer],[data-pop]');
  if (!x) return;
  if (x.dataset.explore) x.dataset.explore === 'business' ? go('business') : openDrawer(x.dataset.explore);
  else if (x.dataset.drawer) openDrawer(x.dataset.drawer);
  else if (x.dataset.pop) setPop(true);
});

/* ================================================================ */
/* conversation: a clean feed of cards                              */
/* ================================================================ */

const feed = $('#feed');
const feedInner = $('#feed-inner');
const nearBottom = () => feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
const scrollToEnd = (force = false) => { if (force || nearBottom()) requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' })); };

/* The conversation is its own page; these stay as no-ops for older callers. */
function setConvo(open) { ui.convoOpen = true; if (open) scrollToEnd(true); }
function setPeek() {}

function addUserMessage(m) {
  // another device's message shouldn't pull you off a dashboard page; it's in the conversation when you go back
  if (ui.route !== 'chat' && !DASH.has(ui.route) && !ui.holdHome && !ui.quietSend) go('chat');
  ui.quietSend = false;
  const el = document.createElement('div');
  el.className = 'msg user';
  if (m.voice) el.innerHTML = `<span class="voice-tag">${ICON.mic}said aloud</span><br>`;
  if (m.images?.length) el.insertAdjacentHTML('beforeend', `<span class="msg-pics">${m.images.map((p) => `<img src="${p.url}" alt="${esc(p.name ?? 'Picture')}">`).join('')}</span>`);
  if (m.text) el.append(document.createTextNode(m.text));
  feedInner.append(el);
  const w = document.createElement('div');
  w.className = 'working';
  w.innerHTML = '<span class="lamps" aria-hidden="true"><i></i><i></i><i></i></span><span class="w-label">Thinking…</span>';
  feedInner.append(w);
  ui.turn = { el: w, steps: [], tools: new Set(), at: performance.now() };
  orbit.look();
  const from = ui.flyFrom;
  ui.flyFrom = null;
  feed.scrollTop = feed.scrollHeight;
  if (from && !reduced.matches) fly(el, from);
}

/* The words you typed lift out of the composer and settle as your bubble. */
const FLY_PROPS = ['font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'padding', 'border-radius', 'background-color', 'border', 'box-shadow', 'backdrop-filter'];
function fly(el, from) {
  el.style.animation = 'none';
  const to = el.getBoundingClientRect();
  if (!to.width) return;
  const cs = getComputedStyle(el);
  const c = el.cloneNode(true);
  c.className = 'fly';
  FLY_PROPS.forEach((k) => c.style.setProperty(k, cs.getPropertyValue(k)));
  Object.assign(c.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, boxSizing: 'border-box', fontFamily: cs.fontFamily });
  document.body.append(c);
  el.style.visibility = 'hidden';
  const dx = from.left - (to.left + parseFloat(cs.paddingLeft));
  const dy = from.top - (to.top + parseFloat(cs.paddingTop));
  const a = c.animate([
    { transform: `translate(${dx}px, ${dy}px)`, backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', boxShadow: 'none', offset: 0 },
    { backgroundColor: 'rgba(0,0,0,0)', offset: 0.25 },
    { transform: 'none', offset: 1 },
  ], { duration: 720, easing: 'cubic-bezier(.2,.9,.25,1)' });
  const done = () => { el.style.visibility = ''; c.remove(); };
  a.onfinish = done; a.oncancel = done;
}

function setWorking(text) {
  if (ui.turn?.el) $('.w-label', ui.turn.el).textContent = text;
  if (ui.turn) setPeek(text);
}

function upsertLeoMessage(m) {
  let el = ui.messages.get(m.id);
  if (!el) {
    const turn = ui.turn;
    ui.turn = null;
    turn?.el.remove();
    el = document.createElement('article');
    el.className = 'msg leo';
    const steps = turn?.steps ?? [];
    const tools = [...(turn?.tools ?? [])];
    const meta = steps.length
      ? `<button class="meta" aria-expanded="false">${steps.length} step${steps.length === 1 ? '' : 's'}${tools.length ? ` · ${esc(tools.slice(0, 2).join(', '))}${tools.length > 2 ? ` +${tools.length - 2}` : ''}` : ''}${ICON.chev}</button>`
      : '';
    const at = new Date(m.at ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    el.innerHTML = `<div class="msg-head"><span class="who">ORION</span><span class="tok" hidden></span><span class="secs" hidden></span><span class="route" hidden></span>${meta}<time class="at">${at}</time></div><div class="body"></div>${steps.length ? `<ul class="steps-list">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}`;
    $('button.meta', el)?.addEventListener('click', (e) => e.currentTarget.setAttribute('aria-expanded', String(el.classList.toggle('open'))));
    ui.lastLeo?.classList.remove('live');
    el.classList.add('live');
    ui.lastLeo = el;
    feedInner.append(el);
    ui.messages.set(m.id, el);
    // asked from the ORION page: he thought there on the big sphere; now his answer opens the conversation
    if (ui.holdHome && m.id !== 'welcome') { ui.holdHome = false; if (ui.route === 'home') { go('chat'); requestAnimationFrame(() => scrollToEnd(true)); } }
    el._sent = m.id !== 'welcome' ? turn?.at : undefined;
    const tier = ui.routes.get(m.id) ?? m.route?.tier ?? m.route ?? m.tier ?? (m.id !== 'welcome' ? ui.nextRoute : null);
    if (m.id !== 'welcome') ui.nextRoute = null;
    if (tier) tagRoute(el, tier);
  }
  const body = $('.body', el);
  // ORION can take a reply back mid-stream (text resets to "") and start it again: show him thinking meanwhile
  if (!m.text && m.streaming) {
    el.classList.add('redo', 'streaming');
    body.innerHTML = '<span class="working"><span class="lamps" aria-hidden="true"><i></i><i></i><i></i></span><span class="w-label">Thinking…</span></span>';
    body._len = 0;
    $('.tok', el).hidden = true;
    scrollToEnd();
    return;
  }
  el.classList.remove('redo');
  const grew = m.text.length - (body._len ?? 0);
  body._len = m.text.length;
  renderBody(body, m);
  if (m.streaming && grew > 0) orbit.talk(Math.min(1, 0.5 + grew / 24));
  el.classList.toggle('streaming', !!m.streaming);
  el.classList.toggle('interrupted', !!m.interrupted);
  readouts(el, m);
  scrollToEnd();
}

/* Web answers end with a "Sources" line; once the reply is complete it becomes small links.
   A `sources: [{title, url}]` list on the final frame (proposed) wins over reading the text. */
function renderBody(body, m) {
  const src = m.streaming ? null : splitSources(m);
  if (!src) { body.textContent = m.text; return; }
  body.textContent = src.text;
  const nav = document.createElement('div');
  nav.className = 'sources';
  src.items.forEach(({ title, url }) => {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = title; a.title = url;
    nav.append(a);
  });
  body.append(nav);
}
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
function splitSources(m) {
  if (Array.isArray(m.sources) && m.sources.length) {
    const items = m.sources.filter((x) => /^https?:\/\//.test(x?.url ?? '')).map((x) => ({ url: x.url, title: x.title || hostOf(x.url) }));
    const at = m.text.search(/\n\s*Sources?\s*:/i);
    return items.length ? { text: (at >= 0 ? m.text.slice(0, at) : m.text).trimEnd(), items } : null;
  }
  const at = m.text.search(/(^|\n)\s*Sources?\s*:/i);
  if (at < 0) return null;
  const tail = m.text.slice(at);
  const urlRe = /https?:\/\/[^\s,;)\]]+/g;
  let items = [...tail.matchAll(urlRe)].map(([u]) => ({ url: u.replace(/[.]+$/, ''), title: hostOf(u.replace(/[.]+$/, '')) }));
  // bare site names ("bbc.com, reuters.com") too, alongside or instead of full links
  items = items.concat([...tail.replace(urlRe, ' ').replace(/^\s*Sources?\s*:/i, '').matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi)].map(([d]) => ({ url: `https://${d}`, title: d.replace(/^www\./, '') })));
  const seen = new Set();
  items = items.filter((x) => !seen.has(x.title) && seen.add(x.title)).slice(0, 6);
  return items.length ? { text: m.text.slice(0, at).trimEnd(), items } : null;
}

/* Beside his name: tokens in green, seconds to answer in red. Uses the server's numbers when a
   frame carries them (`tokens` / `usage`, `ms`), else counts tokens from the text (~4 chars each)
   and times the reply here, from your send to his last word. */
function readouts(el, m) {
  if (m.id === 'welcome') return;
  const real = m.tokens ?? m.usage?.output_tokens ?? m.usage?.total_tokens;
  const tok = $('.tok', el);
  const n = real ?? Math.max(1, Math.round(m.text.length / 4));
  tok.hidden = false;
  tok.textContent = `${real == null ? '~' : ''}${n.toLocaleString()} tok`;
  tok.title = real == null ? 'Tokens, estimated from the reply' : 'Tokens';
  if (m.streaming) return;
  const ms = m.ms ?? (el._sent != null ? performance.now() - el._sent : null);
  if (ms == null) return;
  const s = ms / 1000;
  const secs = $('.secs', el);
  secs.hidden = false;
  secs.textContent = `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  secs.title = 'Seconds from your message to his last word';
}

/* ---------- which brain answered: the `route` event (tier: local | haiku | sonnet) ---------- */
const TIERS = { local: 'Local', haiku: 'Haiku', sonnet: 'Sonnet' };
ui.routes = new Map(); ui.nextRoute = null;
function tagRoute(el, tier) {
  const r = el.querySelector('.route');
  if (!r || !tier) return;
  r.hidden = false;
  r.dataset.tier = tier;
  r.textContent = TIERS[tier] ?? tier;
  r.title = tier === 'local' ? 'Answered by the local model on the PC' : `Answered by Claude ${TIERS[tier] ?? tier}`;
}
client.on('route', ({ tier, id }) => {
  if (!tier) return;
  if (ui.turn || ACTIVE.has(ui.state)) orbit.setClaude(tier === 'haiku' || tier === 'sonnet');
  if (id && ui.messages.has(id)) return tagRoute(ui.messages.get(id), tier);
  if (id) return ui.routes.set(id, tier);
  // no id: the reply that's streaming now, or else the next one
  const live = ui.lastLeo;
  if (live?.classList.contains('streaming')) tagRoute(live, tier);
  else ui.nextRoute = tier;
});

/* ---------- Local / Local+: the account's own switch. A divided circle that opens into the two positions ---------- */
let cloudWait = 0;
function renderCloud() {
  const box = $('#cloud');
  const c = client.cloud;
  box.hidden = !c;
  if (!c) return;
  const want = ui.cloudWant ?? !!c.own;
  const owner = account()?.role === 'owner' || (canAct() && !account());
  const spent = (c.allowance_left_usd ?? 1) <= 0 || (c.budget_remaining_usd ?? 1) <= 0;
  // locked when the cause isn't this person's to change: no key, out of money, or (for guests) the master switch
  const locked = c.configured === false || spent || (c.master === false && !owner);
  box.classList.toggle('plus', c.mode === 'local+');
  box.classList.toggle('want-plus', want);
  box.classList.toggle('pending', ui.cloudWant != null);
  $$('[data-cloud]', box).forEach((b) => {
    const on = b.dataset.cloud === '1';
    b.setAttribute('aria-checked', String(on === want));
    b.disabled = locked && on;
  });
}
$('#cloud').addEventListener('click', (e) => {
  if (!e.target.closest('.cloud-sw')) return;
  // a click anywhere on the slider flips it
  const on = !(ui.cloudWant ?? !!client.cloud?.own);
  const b = $(`[data-cloud="${on ? 1 : 0}"]`, $('#cloud'));
  if (b.disabled) return;
  {
    ui.cloudWant = on;
    haptic(6);
    client.setCloud(on);
    clearTimeout(cloudWait);
    cloudWait = setTimeout(() => { ui.cloudWant = null; renderCloud(); }, 8000);   // no answer: show what ORION last said
    renderCloud();
  }
  if (e.detail) document.activeElement?.blur();            // pointer clicks: fold back once the pointer leaves (keyboard keeps it open)
});
client.on('cloud', () => { clearTimeout(cloudWait); ui.cloudWant = null; renderCloud(); });

function welcome() {
  if (ui.welcomed) return;
  ui.welcomed = true;
  const s = client.snapshot();
  s.approvals.forEach((a) => ui.knownApprovals.add(a.id));
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const done = s.tasks.filter((t) => t.status === 'done').length;
  const pending = s.approvals.filter((a) => a.status === 'pending').length;
  upsertLeoMessage({
    id: 'welcome', role: 'leo', streaming: false,
    text: client.mode === 'live'
      ? `${greet}, ${address()}.${pending ? ` ${pending === 1 ? 'One approval is' : `${pending} approvals are`} waiting under the bell.` : ''}`
      : canAct()
      ? `${greet}. While you were away I finished ${done} tasks and kept an eye on Ciel.${pending ? ` ${pending === 1 ? 'One approval is' : `${pending} approvals are`} waiting under the bell.` : ''}`
      : `${greet}, ${address()}. What can I do for you?`,
  });
  updateBadge();
}

/* ================================================================ */
/* dock: stats, ask, chips                                          */
/* ================================================================ */

const STATS = [
  { id: 'tps', label: 'Generation', icon: ICON.bolt, open: 'tasks' },
  { id: 'gpu', label: 'GPU load', icon: ICON.chip, open: 'tasks' },
  { id: 'tasks', label: 'Tasks running', icon: ICON.tasks, open: 'tasks' },
  { id: 'waiting', label: 'Waiting on you', icon: ICON.bell, open: 'approvals' },
];
$('#stats').innerHTML = STATS.map((s) => `<button class="stat" role="listitem" data-stat="${s.id}"><span class="s-label">${s.label}</span><span class="s-row">${s.icon}<span class="s-val" id="st-${s.id}">—</span><span class="s-unit" id="su-${s.id}"></span></span></button>`).join('');
$('#stats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-stat]');
  if (!b) return;
  const open = STATS.find((s) => s.id === b.dataset.stat).open;
  open === 'approvals' ? setPop(true) : openDrawer(open);
});

function setStat(id, val, unit = '') {
  const el = $(`#st-${id}`);
  if (!el) return;
  $(`#su-${id}`).textContent = unit;
  if (el.textContent === val) return;
  const first = el.textContent === '—';
  el.textContent = val;
  if (!first && id !== 'tps' && id !== 'gpu') {
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    ui.activeStat = id;
  }
  $$('.stat').forEach((s) => s.classList.toggle('on', s.dataset.stat === ui.activeStat));
}

function renderStats() {
  const v = client.vitals;
  setStat('tps', v.tps ? v.tps.toFixed(0) : '0', 'tok/s');
  setStat('gpu', String(Math.round(v.gpu ?? 0)), '%');
  const s = client.snapshot();
  const running = s.tasks.filter((t) => t.status === 'running').length;
  const queued = s.tasks.filter((t) => t.status === 'queued').length;
  setStat('tasks', String(running), queued ? `+${queued} queued` : '');
  const n = waitingCount();
  setStat('waiting', String(n), n === 1 ? 'approval' : 'approvals');
}

$$('[data-open]').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.open)));
$('#brand').innerHTML = orionLogo({ strands: 3, spread: 1.6 });
$('#brand').addEventListener('click', () => playIntro({ brand: $('#brand'), force: true }));
playIntro({ brand: $('#brand'), force: new URLSearchParams(location.search).has('intro'), gate: client.needsLogin ? loginGate : null });

/* ---------- login: over the open ORION name, before the capitals fly home ---------- */
function loginGate(panel) {
  panel.innerHTML = `
    <h1 class="gate-hi">Welcome</h1>
    <form class="gate" novalidate>
      <label class="sr-only" for="g-name">Name</label>
      <input class="gate-in" id="g-name" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Name" enterkeyhint="next">
      <label class="sr-only" for="g-pass">Password</label>
      <input class="gate-in" id="g-pass" name="password" type="password" autocomplete="current-password" placeholder="Password" enterkeyhint="go">
      <button class="gate-go" type="submit" disabled>Connect</button>
      <p class="gate-err" role="alert"></p>
    </form>`;
  const form = panel.querySelector('form');
  const name = form.querySelector('#g-name'), pass = form.querySelector('#g-pass'), go = form.querySelector('.gate-go');
  const err = form.querySelector('.gate-err');
  let fails = 0, busy = false;
  const ready = () => { go.disabled = busy || !name.value.trim() || !pass.value; };
  form.addEventListener('input', () => { ready(); err.textContent = ''; });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !pass.value) { e.preventDefault(); pass.focus(); } });
  if (isWide()) setTimeout(() => name.focus({ preventScroll: true }), 900);
  return new Promise((resolve) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (go.disabled) return;
      busy = true; ready(); form.classList.add('busy');
      go.textContent = 'Connecting';
      try {
        await client.login(name.value.trim(), pass.value);
        go.textContent = 'Connected';
        haptic(8);
        setTimeout(resolve, 350);
      } catch (x) {
        busy = false; form.classList.remove('busy');
        go.textContent = 'Connect';
        fails += 1;
        err.textContent = x?.reason === 'network' ? 'Can’t reach ORION. Is he running?'
          : fails >= 3 ? 'Wrong name or password. Five misses locks this device out for 10 minutes.' : 'Wrong name or password.';
        pass.value = ''; ready();
        pass.focus();
        if (!reduced.matches) form.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 360, easing: 'ease-out' });
      }
    });
  });
}
// a saved login that stops working (password changed, account removed): ask again
client.on('connection', ({ reason }) => { if (reason === 'auth') playIntro({ brand: $('#brand'), gate: loginGate }); });

const input = $('#input');
const setPlaceholder = () => { input.placeholder = 'Ask ORION'; };
setPlaceholder();
wideMQ.addEventListener('change', setPlaceholder);
const form = $('#compose-form');
function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  $('#btn-send').disabled = !input.value.trim();
}
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
});
input.addEventListener('focus', () => { $('#composer').classList.add('focus'); if (!isWide()) body.classList.add('typing'); });
input.addEventListener('blur', () => { $('#composer').classList.remove('focus'); body.classList.remove('typing'); });
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text && !ui.pics.length) return;
  if (ui.picsBusy) return;
  const r = input.getBoundingClientRect(), cs = getComputedStyle(input);
  ui.flyFrom = { left: r.left + parseFloat(cs.paddingLeft), top: r.top + parseFloat(cs.paddingTop) };
  input.value = '';
  autosize();
  const images = ui.pics;
  ui.pics = [];
  renderPics();
  sendText(text, images);
});
function sendText(text, images = []) {
  // from the ORION page you stay with him while he thinks; the conversation opens with his answer
  if (ui.route === 'home') ui.holdHome = true;
  else if (ui.route !== 'chat') go('chat');
  client.send(text, images.length ? { images } : undefined);
}

/* ---------- pictures: up to 4, shrunk here to 1600 px JPEG before they go to ORION ---------- */
const PIC_MAX = 4;
ui.pics = [];
async function shrinkPic(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return null;
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  if (!blob) return null;
  const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  return { name: `${(file.name || 'picture').replace(/\.[^.]+$/, '')}.jpg`, mime: 'image/jpeg', data, url: URL.createObjectURL(blob) };
}
async function addPics(files) {
  const imgs = [...files].filter((f) => f.type.startsWith('image/')).slice(0, PIC_MAX - ui.pics.length);
  if (!imgs.length) return;
  ui.picsBusy = true; renderPics(imgs.length);
  for (const f of imgs) { const p = await shrinkPic(f); if (p) ui.pics.push(p); }
  ui.picsBusy = false; renderPics();
  input.focus();
}
function renderPics(loading = 0) {
  const box = $('#pics');
  box.hidden = !ui.pics.length && !loading;
  box.innerHTML = ui.pics.map((p, i) => `<span class="pic"><img src="${p.url}" alt="${esc(p.name)}"><button type="button" data-pic-x="${i}" aria-label="Remove ${esc(p.name)}">${X_SVG}</button></span>`).join('')
    + Array.from({ length: loading }, () => '<span class="pic loading" aria-label="Preparing picture"></span>').join('');
  $('#btn-plus').disabled = ui.pics.length >= PIC_MAX;
}
$('#pics').addEventListener('click', (e) => {
  const x = e.target.closest('[data-pic-x]');
  if (!x) return;
  const [p] = ui.pics.splice(Number(x.dataset.picX), 1);
  URL.revokeObjectURL(p?.url);
  renderPics();
});
$('#pic-in').addEventListener('change', (e) => { addPics(e.target.files); e.target.value = ''; });
input.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); addPics(files); }
});
$('#composer').addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.items ?? [])].some((i) => i.type.startsWith('image/'))) { e.preventDefault(); $('#composer').classList.add('drop'); } });
$('#composer').addEventListener('dragleave', () => $('#composer').classList.remove('drop'));
$('#composer').addEventListener('drop', (e) => { $('#composer').classList.remove('drop'); if (e.dataTransfer?.files?.length) { e.preventDefault(); addPics(e.dataTransfer.files); } });
const newTask = () => {
  input.value = 'Add a task: ';
  autosize();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
};
$('#btn-new-task').addEventListener('click', newTask);
$('#btn-plus').addEventListener('click', () => $('#pic-in').click());

/* ================================================================ */
/* approvals: dropdown from the bell, with a 5s undo                */
/* ================================================================ */

const pop = $('#approvals-pop');
const bell = $('#btn-approvals');

function setPop(open) {
  ui.popOpen = open;
  pop.classList.toggle('open', open);
  pop.setAttribute('aria-hidden', String(!open));
  bell.setAttribute('aria-expanded', String(open));
  bell.classList.toggle('on', open);
  $('#pop-catcher').classList.toggle('on', open);
  if (open) { renderApprovals(); haptic(5); }
}
bell.addEventListener('click', () => setPop(!ui.popOpen));
$('#pop-catcher').addEventListener('pointerdown', () => setPop(false));

const waitingCount = () => client.snapshot().approvals.filter((a) => a.status === 'pending' && !ui.decisions.has(a.id)).length;

function updateBadge() {
  const n = waitingCount();
  $('#approval-dot').hidden = n === 0;
  bell.setAttribute('aria-label', n ? `Approvals, ${n} waiting` : 'Approvals');
}
function bumpBadge() {
  const b = $('#approval-dot');
  b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
}

function decide(id, decision) {
  if (ui.decisions.has(id)) return;
  haptic(decision === 'approve' ? 12 : 6);
  const timer = setTimeout(() => commit(id), UNDO_MS);
  ui.decisions.set(id, { decision, until: Date.now() + UNDO_MS, timer });
  refreshDecisionViews();
}
function undo(id) {
  const d = ui.decisions.get(id);
  if (!d) return;
  clearTimeout(d.timer);
  ui.decisions.delete(id);
  haptic(6);
  refreshDecisionViews();
}
function commit(id) {
  const d = ui.decisions.get(id);
  if (!d) return;
  ui.decisions.delete(id);
  d.decision === 'approve' ? client.approve(id) : client.reject(id);
  refreshDecisionViews();
}
function refreshDecisionViews() {
  updateBadge(); renderApprovals(); renderStats(); renderSummaryFlag();
  if (tasksOpen()) renderTasks();
}

const undoBar = (id) => {
  const d = ui.decisions.get(id);
  const left = Math.max(0, d.until - Date.now());
  return `<div class="ap-undo ${d.decision === 'approve' ? '' : 'rejected'}">
    <span>${d.decision === 'approve' ? 'Approved' : 'Rejected'}</span>
    <button class="text-btn" data-undo="${id}">Undo</button>
    <span class="timer" style="animation-duration:${left}ms"></span>
  </div>`;
};

function renderApprovals() {
  if (!ui.popOpen) return;
  const all = client.snapshot().approvals;
  const waiting = all.filter((a) => a.status === 'pending').sort((a, b) => b.at - a.at);
  const recent = all.filter((a) => a.status !== 'pending').sort((a, b) => (b.resolvedAt ?? b.at) - (a.resolvedAt ?? a.at)).slice(0, 5);
  const n = waitingCount();
  $('#pop-count').textContent = n ? `${n} waiting` : '';
  $('#pop-body').innerHTML = `
    ${waiting.length ? waiting.map((a) => {
      const open = ui.expanded.has(a.id);
      return `<article class="ap ${open ? 'open' : ''}">
        <button class="ap-main" data-toggle="${a.id}" aria-expanded="${open}">
          <span class="ap-title">${esc(a.title)}</span><span class="ap-chev" aria-hidden="true">${ICON.chev}</span>
          <span class="ap-sum">${esc(a.summary)}</span>
          <span class="ap-meta">${esc(a.source)} · ${agoLong(a.at)}</span>
        </button>
        ${a.preview ? `<div class="ap-preview">${esc(a.preview)}</div>` : ''}
        ${ui.decisions.has(a.id) ? undoBar(a.id) : `<div class="ap-actions">
          <button class="btn secondary" data-reject="${a.id}">Reject</button>
          <button class="btn primary" data-approve="${a.id}">Approve</button>
        </div>`}
      </article>`;
    }).join('') : `<div class="pop-empty">${ICON.allClear}<span>You’re all caught up.</span></div>`}
    ${recent.length ? `<div class="pop-sub">Recent</div><div class="group">${recent.map((a) => `
      <div class="ap-recent ${a.status}">${a.status === 'approved' ? ICON.done : ICON.rejected}<span>${esc(a.title)}</span><span class="when">${ago(a.resolvedAt ?? a.at)}</span></div>`).join('')}</div>` : ''}`;
}

function onDecisionClick(e) {
  const t = e.target.closest('[data-approve],[data-reject],[data-undo],[data-toggle]');
  if (!t) return;
  const { approve, reject, undo: u, toggle } = t.dataset;
  if (approve) decide(approve, 'approve');
  else if (reject) decide(reject, 'reject');
  else if (u) undo(u);
  else if (toggle) {
    ui.expanded.has(toggle) ? ui.expanded.delete(toggle) : ui.expanded.add(toggle);
    renderApprovals();
  }
}
$('#pop-body').addEventListener('click', onDecisionClick);


/* ================================================================ */
/* hands-free voice                                                 */
/* ================================================================ */

const voice = {
  on: false, micLevel: 0, leoAmp: 0, recog: null, stream: null, analyser: null, scriptIdx: 0, scriptTimer: null, raf: 0,

  async start() {
    if (this.on) return;
    this.on = true;
    haptic(10);
    form.hidden = true;
    $('#voice-bar').hidden = false;
    $('#btn-voice').classList.add('on');
    $('#btn-send').hidden = true; $('#btn-voice-end').hidden = false;
    $('#btn-voice').setAttribute('aria-label', 'Stop hands-free voice');
    this.setText('Go ahead, I’m listening.', true);
    try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch {}
    await this.openMic();
    this.loop();
    this.listen();
  },

  stop() {
    if (!this.on) return;
    this.on = false;
    clearTimeout(this.scriptTimer);
    try { this.recog?.abort(); } catch {}
    this.recog = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.analyser = null;
    cancelAnimationFrame(this.raf);
    client.interrupt();
    client.setListening(false);
    $('#voice-bar').hidden = true;
    form.hidden = false;
    $('#btn-voice').classList.remove('on');
    $('#btn-send').hidden = false; $('#btn-voice-end').hidden = true;
    $('#btn-voice').setAttribute('aria-label', 'Start hands-free voice');
    orbit.setLevel(0);
  },

  async openMic() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(this.stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
    } catch { this.analyser = null; }
  },

  readMic() {
    if (!this.analyser) return client.state === 'listening' ? 0.08 + Math.random() * 0.08 : 0;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
    return Math.min(1, Math.sqrt(sum / buf.length) * 6);
  },

  loop() {
    const cv = $('#wave');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const bars = Array(9).fill(0);
    const draw = () => {
      if (!this.on) return;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      this.micLevel = this.micLevel * 0.7 + this.readMic() * 0.3;
      const speaking = client.state === 'speaking';
      const lvl = speaking ? this.leoAmp : this.micLevel;
      if (client.state === 'listening') orbit.setLevel(this.micLevel * 0.6);
      const bw = 4, gap = (W - bars.length * bw) / (bars.length - 1);
      bars.forEach((_, i) => {
        const shape = 1 - Math.abs(i - 4) / 5;
        const target = Math.max(0.1, lvl * shape * (0.7 + Math.random() * 0.6));
        bars[i] += (target - bars[i]) * 0.35;
        const h = Math.max(4, bars[i] * H);
        ctx.fillStyle = speaking ? '#f6ecd6' : client.state === 'listening' ? '#e7c983' : '#5a554c';
        ctx.beginPath();
        ctx.roundRect(i * (bw + gap), (H - h) / 2, bw, h, 2);
        ctx.fill();
      });
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  },

  setText(t, placeholder = false) {
    const el = $('#voice-transcript');
    el.textContent = t;
    el.classList.toggle('placeholder', placeholder);
  },

  listen() {
    if (!this.on) return;
    client.setListening(true);
    $('#voice-state').textContent = 'Listening';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR && !this.srFailed) {
      // Demo only: the browser transcribes. In production the mic streams to ORION and Whisper does this.
      const r = new SR();
      r.lang = 'en-US'; r.interimResults = true; r.continuous = false;
      let final = '';
      r.onresult = (e) => {
        let interim = '';
        for (const res of e.results) (res.isFinal ? (final = res[0].transcript) : (interim += res[0].transcript));
        this.setText(final || interim);
      };
      r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.srFailed = true; };
      r.onend = () => {
        this.recog = null;
        if (!this.on) return;
        if (final.trim()) this.utter(final.trim());
        else setTimeout(() => this.listen(), this.srFailed ? 0 : 250);
      };
      this.recog = r;
      try { r.start(); } catch { this.srFailed = true; this.listen(); }
      return;
    }
    this.scripted();
  },

  scripted() {
    const lines = ['Hey ORION, how did the ads do this week?', 'Okay, help me plan the Black Friday launch.', 'What’s your GPU at right now?'];
    if (this.scriptIdx >= lines.length) { this.setText('Demo script finished. Tap × to end.', true); return; }
    const words = lines[this.scriptIdx++].split(' ');
    let i = 0;
    this.setText('', false);
    const tick = () => {
      if (!this.on) return;
      this.micLevel = 0.5 + Math.random() * 0.4;
      this.setText(words.slice(0, ++i).join(' '));
      if (i < words.length) this.scriptTimer = setTimeout(tick, 170 + Math.random() * 120);
      else this.scriptTimer = setTimeout(() => this.utter(words.join(' ')), 650);
    };
    this.scriptTimer = setTimeout(tick, 1400);
  },

  utter(text) {
    $('#voice-state').textContent = 'Thinking';
    this.setText(text);
    client.send(text, { voice: true });
  },

  onLeoState(state) {
    if (!this.on) return;
    if (state === 'speaking') $('#voice-state').textContent = 'ORION is speaking. Tap × to cut in';
    else if (state === 'thinking' || state === 'working') $('#voice-state').textContent = 'Thinking';
    else if (state === 'idle' && !this.recog && !ui.turn) setTimeout(() => this.on && client.state === 'idle' && this.listen(), 500);
  },
};
$('#btn-voice').addEventListener('click', () => (voice.on ? voice.stop() : voice.start()));
$('#btn-voice-end').addEventListener('click', () => voice.stop());

/* ================================================================ */
/* dashboards drawer                                                */
/* ================================================================ */

const drawer = $('#drawer');

/* The drawer is ORION's task board, full screen: Always, Daily and Scheduled. */
function openDrawer() {
  ui.panel = 'tasks';
  ui.drawerOpen = true;
  $$('[data-open]').forEach((b) => b.classList.add('on'));
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('on');
  setPop(false);
  renderTasks();
  haptic(6);
  setTimeout(() => $('#btn-drawer-close').focus({ preventScroll: true }), 50);
}
function closeDrawer() {
  ui.drawerOpen = false;
  ui.watchResult = '';
  $$('[data-open]').forEach((b) => b.classList.remove('on'));
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  $('#scrim').classList.toggle('on', !isWide() && ui.detailOpen);
}
$('#btn-menu').addEventListener('click', () => openDrawer());
$('#btn-drawer-close').addEventListener('click', closeDrawer);
$('#scrim').addEventListener('click', () => { if (ui.drawerOpen) closeDrawer(); else setDetail(false); });
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#tk-ask').hidden) closeAsk();
  else if (ui.popOpen) setPop(false);
  else if (ui.drawerOpen) closeDrawer();
  else if (ui.detailOpen) setDetail(false);
  else if (ui.route === 'chat' && document.activeElement !== input) go('home');
  else if (ui.route === 'chat') input.blur();
});
const tasksOpen = () => ui.drawerOpen;

/* ---------- Tasks ---------- */
// Three kinds. Always: things ORION keeps checking (the watch list, ACCOUNTS.md §4).
// Daily: his routines (task ids routine_<name>). Scheduled: dated things on a calendar
// (timers, and any task carrying a `due` / `next` time). New tasks are described in plain
// words and sent to ORION with a short note of which kind they are; he files them himself.
const isHeartbeat = (a) => a.kind === 'think' && /heartbeat/i.test(a.title ?? '');
const isRoutine = (t) => /^routine_/.test(t.id ?? '');
const whenOf = (t) => t.due ?? t.next ?? t.at ?? null;
const isDated = (t) => !isRoutine(t) && (/^timer_/.test(t.id ?? '') || (t.due ?? t.next) != null) && t.status !== 'done' && t.status !== 'rejected';
let watchWait = 0;
ui.watchGoing = new Set();
ui.tab = 'always';
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
ui.cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: +today0() };

const clockAt = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayKey = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return +d; };
const longDay = (ms) => new Date(ms).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
const isoDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const TABS = ['always', 'daily', 'scheduled'];
function setTab(t) {
  ui.tab = t;
  $$('#tk-tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $('#tk-thumb').style.transform = `translateX(${TABS.indexOf(t) * 100}%)`;
  renderTasks();
  $('#drawer-body').scrollTop = 0;
}
$('#tk-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]')?.dataset.tab; if (t) { setTab(t); haptic(4); } });

const newBtn = (label) => `<button type="button" class="tk-new" data-new>${label}</button>`;
const rowX = (id, label) => `<button class="tk-x" data-unwatch="${esc(id)}" aria-label="Remove: ${esc(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button>`;

function renderTasks() {
  const el = $('#panel-tasks');
  if (!el) return;
  const s = client.snapshot();
  const running = s.tasks.filter((t) => t.status === 'running' && !isRoutine(t));
  const now = running.length
    ? `<div class="tk-now"><span class="tk-live" aria-hidden="true"></span><span class="tk-now-t">${esc(running[0].title)}</span><span class="tk-now-p">${Math.round((running[0].progress || 0) * 100)}%</span>${running.length > 1 ? `<span class="tk-now-more">+${running.length - 1}</span>` : ''}</div>`
    : '';
  let body = '';

  if (ui.tab === 'always') {
    const items = [...(s.watch?.items ?? [])].sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
    const hits = s.activity.filter(isHeartbeat).sort((a, b) => b.at - a.at).slice(0, 3);
    body = `
      <div class="tk-list">${items.length ? items.map((it) => `
        <div class="tk-item${ui.watchGoing.has(it.id) ? ' going' : ''}"><span class="tk-t">${esc(it.text)}</span>${rowX(it.id, it.text)}</div>`).join('')
        : '<p class="tk-empty">Nothing yet.</p>'}
      </div>
      ${newBtn('New always task')}
      ${hits.length ? `<h3 class="tk-sub">Recent</h3><div class="tk-list">${hits.map((a) => `
        <div class="tk-item quiet"><span class="tk-t">${esc(a.detail || a.title)}</span><time>${ago(a.at)}</time></div>`).join('')}</div>` : ''}`;
  }

  if (ui.tab === 'daily') {
    const daily = s.tasks.filter(isRoutine).sort((a, b) => (whenOf(a) ?? 0) % 864e5 - (whenOf(b) ?? 0) % 864e5);
    body = `
      <div class="tk-list">${daily.length ? daily.map((t) => `
        <div class="tk-item"><span class="tk-time">${whenOf(t) ? clockAt(whenOf(t)) : '—'}</span><span class="tk-t">${esc(t.title)}${t.every && !/day/i.test(t.every) ? `<small>every ${esc(t.every)}</small>` : ''}</span></div>`).join('')
        : '<p class="tk-empty">Nothing yet.</p>'}
      </div>
      ${newBtn('New daily task')}`;
  }

  if (ui.tab === 'scheduled') {
    const dated = s.tasks.filter(isDated).filter((t) => whenOf(t));
    const byDay = new Map();
    dated.forEach((t) => { const k = dayKey(whenOf(t)); byDay.set(k, [...(byDay.get(k) ?? []), t]); });
    const { y, m, sel } = ui.cal;
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;                    // weeks start on Monday
    const days = new Date(y, m + 1, 0).getDate();
    const t0 = +today0();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cal-c pad"></span>';
    for (let d = 1; d <= days; d++) {
      const k = +new Date(y, m, d);
      const n = byDay.get(k)?.length ?? 0;
      cells += `<button type="button" class="cal-c${k === t0 ? ' today' : ''}${k === sel ? ' sel' : ''}${k < t0 ? ' past' : ''}" data-day="${k}" aria-label="${longDay(k)}${n ? `, ${n} scheduled` : ''}" aria-pressed="${k === sel}">${d}${n ? '<i></i>' : ''}</button>`;
    }
    const onDay = (byDay.get(sel) ?? []).sort((a, b) => whenOf(a) - whenOf(b));
    const upcoming = dated.filter((t) => whenOf(t) >= t0 && dayKey(whenOf(t)) !== sel).sort((a, b) => whenOf(a) - whenOf(b)).slice(0, 5);
    const row = (t, withDay) => `<div class="tk-item"><span class="tk-time">${withDay ? new Date(whenOf(t)).toLocaleDateString([], { day: 'numeric', month: 'short' }) : clockAt(whenOf(t))}</span><span class="tk-t">${esc(t.title)}</span></div>`;
    body = `
      <div class="cal">
        <div class="cal-head">
          <button type="button" class="cal-nav" data-cal="-1" aria-label="Previous month"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg></button>
          <span class="cal-m">${first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
          <button type="button" class="cal-nav" data-cal="1" aria-label="Next month"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg></button>
        </div>
        <div class="cal-w" aria-hidden="true"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>
        <div class="cal-g">${cells}</div>
      </div>
      <h3 class="tk-sub">${sel === t0 ? 'Today' : longDay(sel)}</h3>
      <div class="tk-list">${onDay.length ? onDay.map((t) => row(t, false)).join('') : '<p class="tk-empty">Nothing on this day.</p>'}</div>
      ${newBtn(`New task on ${new Date(sel).toLocaleDateString([], { day: 'numeric', month: 'short' })}`)}
      ${upcoming.length ? `<h3 class="tk-sub">Coming up</h3><div class="tk-list">${upcoming.map((t) => row(t, true)).join('')}</div>` : ''}`;
  }

  el.innerHTML = `<div class="tk-wrap">${now}${body}</div>`;
}

$('#panel-tasks').addEventListener('click', (e) => {
  if (e.target.closest('[data-new]')) return openAsk(ui.tab);
  const nav = e.target.closest('[data-cal]');
  if (nav) {
    const d = new Date(ui.cal.y, ui.cal.m + Number(nav.dataset.cal), 1);
    ui.cal.y = d.getFullYear(); ui.cal.m = d.getMonth();
    return renderTasks();
  }
  const day = e.target.closest('[data-day]');
  if (day) { ui.cal.sel = Number(day.dataset.day); haptic(4); return renderTasks(); }
  const x = e.target.closest('[data-unwatch]');
  if (x) { ui.watchGoing.add(x.dataset.unwatch); client.watchRemove(x.dataset.unwatch); renderTasks(); }
});
client.on('watch', (w) => {
  clearTimeout(watchWait);
  ui.watchGoing = new Set([...ui.watchGoing].filter((id) => w.items?.some((it) => it.id === id)));
  if (tasksOpen()) renderTasks();
});

/* ---------- Describe your task ---------- */
const KINDS = {
  always: { kind: 'Always', place: 'Tell me if a Ciel order hasn’t shipped in 3 days',
    note: () => '[New task · Always: keep checking this and tell me when it happens]' },
  daily: { kind: 'Daily', place: 'Every morning at 7, sum up last night’s orders',
    note: () => '[New task · Daily: do this every day]' },
  scheduled: { kind: 'Scheduled', place: 'Remind me to order winter samples',
    note: (day) => `[New task · Scheduled for ${new Date(day).toLocaleDateString('en-US', { weekday: 'long' })} ${isoDay(day)}]` },
};
const ask = $('#tk-ask'), askIn = $('#tk-ask-in');
function openAsk(tab) {
  const a = KINDS[tab];
  ui.askTab = tab;
  ui.askDay = ui.cal.sel;
  $('#tk-ask-kind').textContent = tab === 'scheduled' ? `${a.kind} · ${longDay(ui.askDay)}` : a.kind;
  askIn.placeholder = a.place;
  askIn.value = '';
  $('#tk-ask-hint').textContent = 'Enter to send';
  ask.classList.remove('sent');
  ask.hidden = false;
  requestAnimationFrame(() => { ask.classList.add('on'); askIn.focus(); });
  haptic(6);
}
function closeAsk() {
  ask.classList.remove('on');
  setTimeout(() => { if (!ask.classList.contains('on')) ask.hidden = true; }, 220);
}
function sendAsk() {
  const text = askIn.value.trim();
  if (!text) return askIn.focus();
  // the request goes out as a normal message; stay here instead of jumping to the conversation
  ui.quietSend = true;
  client.send(`${KINDS[ui.askTab].note(ui.askDay)} ${text}`, { task: ui.askTab === 'scheduled' ? { kind: 'scheduled', date: isoDay(ui.askDay) } : { kind: ui.askTab } });
  ask.classList.add('sent');
  $('#tk-ask-hint').textContent = 'Sent to ORION';
  haptic(10);
  setTimeout(closeAsk, 700);
}
$('#tk-ask-form').addEventListener('submit', (e) => { e.preventDefault(); sendAsk(); });
askIn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendAsk(); }
  if (e.key === 'Escape') { e.stopPropagation(); closeAsk(); }
});
ask.addEventListener('click', (e) => { if (e.target === ask || e.target.closest('[data-ask-cancel]')) closeAsk(); });

function sparkline(values, { w = 140, h = 30 } = {}) {
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 4) - 2]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts.at(-1);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="#ecdcb4" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="#ecdcb4" stroke="#141210" stroke-width="2" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/* ---------- Vitals, inside ORION's panel ---------- */
function gauge(label, frac, val, sub) {
  const C = 2 * Math.PI * 30;
  const off = C * (1 - Math.max(0, Math.min(1, frac)));
  return `<div class="gauge">
    <svg viewBox="0 0 76 76" aria-hidden="true">
      <circle class="g-track" cx="38" cy="38" r="30" fill="none"/>
      <circle class="g-fill" cx="38" cy="38" r="30" fill="none" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 38 38)"/>
    </svg>
    <span class="g-num">${val}</span>
    <div class="g-label">${label}</div><div class="g-sub">${sub}</div>
  </div>`;
}
function vitalsBlock(v) {
  const tools = client.snapshot().tools.map(describe);
  return `
    <div class="notes-head">${ICON.chip}Vitals</div>
    <div class="gauges">
      ${gauge('VRAM', v.vram / v.vramTotal, v.vram.toFixed(1), `of ${v.vramTotal} GB`)}
      ${gauge('Temp', (v.temp - 30) / 55, `${v.temp}°`, 'celsius')}
      ${gauge('Speed', (v.tps || 0) / 80, (v.tps || 0).toFixed(0), 'tok/s')}
    </div>
    <div class="chart-card">
      <div class="c-title">${(v.tps || 0).toFixed(1)} tokens/sec</div>
      <div class="c-sub">Generation speed, last 60 seconds</div>
      ${sparkline(ui.tpsHistory, { w: 300, h: 56 }).replace('class="spark"', 'class="spark" style="height:56px"')}
    </div>
    <div class="group rows">
      <div class="row"><span>Model</span><span class="v">${esc(v.model)}</span></div>
      <div class="row"><span>Uptime</span><span class="v">${uptime(v.uptime)} ${Math.floor((v.uptime % 3600) / 60)}m</span></div>
      <div class="row"><span>Queue</span><span class="v">${v.queue}</span></div>
      <div class="row"><span>Voice</span><span class="v">Whisper + Kokoro</span></div>
      <div class="row"><span>Connection</span><span class="v">${client.mode === 'mock' ? 'Demo data' : 'Tailscale'}</span></div>
    </div>
    <div class="notes-head">${ICON.tool}Tools</div>
    <div class="group rows">
      ${tools.map((t) => `<button type="button" class="row tool-row" data-tool="${esc(t.id)}"><span>${ICON[t.id] ?? ICON.tool}${esc(t.name)}</span><span class="v">${t.calls ?? 0} calls${t.lastUsed ? ` · ${ago(t.lastUsed)}` : ''}</span></button>`).join('')}
    </div>`;
}

/* ================================================================ */
/* push-style banners                                               */
/* ================================================================ */

function showBanner(n) {
  const layer = $('#banner-layer');
  const el = document.createElement('div');
  el.className = 'banner';
  el.innerHTML = `<span class="app-icon" aria-hidden="true"></span><div><div class="b-title"></div><div class="b-body"></div></div><span class="b-time">now</span>`;
  $('.b-title', el).textContent = n.title;
  $('.b-body', el).textContent = n.body;
  layer.append(el);

  let y = -120, v = 0, raf = 0, dragging = false, startY = 0, base = 0, hist = [];
  const w = (2 * Math.PI) / 0.4;
  const paint = () => { el.style.transform = `translateY(${y}px)`; el.style.opacity = String(Math.max(0, Math.min(1, 1 + y / 120))); };
  const run = (to, vel = 0, onDone) => {
    cancelAnimationFrame(raf); v = vel;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.max(0, Math.min(0.032, (now - last) / 1000)); last = now;
      for (let i = 0; i < 4; i++) { const a = -w * w * (y - to) - 2 * w * v; v += (a * dt) / 4; y += (v * dt) / 4; }
      paint();
      if (Math.abs(y - to) < 0.5 && Math.abs(v) < 5) { y = to; paint(); return onDone?.(); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const dismiss = (vel = 0) => { clearTimeout(timer); run(-140, vel, () => el.remove()); };
  paint(); run(0);
  let timer = setTimeout(() => dismiss(), 5200);

  el.addEventListener('pointerdown', (e) => { dragging = true; startY = e.clientY; base = y; hist = [[e.timeStamp, e.clientY]]; cancelAnimationFrame(raf); clearTimeout(timer); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    y = base + (dy > 0 ? rubber(dy, 200) : dy); paint();
    hist.push([e.timeStamp, e.clientY]); if (hist.length > 5) hist.shift();
  });
  el.addEventListener('pointerup', (e) => {
    if (!dragging) return; dragging = false;
    const moved = Math.abs(e.clientY - startY);
    const [t0, y0] = hist[0], [t1, y1] = hist.at(-1);
    const vel = t1 > t0 ? ((y1 - y0) / (t1 - t0)) * 1000 : 0;
    if (moved < 6) {
      dismiss();
      if (n.target?.approvalId) { ui.expanded.add(n.target.approvalId); setPop(true); }
      else openDrawer();
      return;
    }
    if (y + project(vel) < -40) dismiss(vel);
    else { run(0, vel); timer = setTimeout(() => dismiss(), 4000); }
  });
}

/* ================================================================ */
/* pages: ORION, the conversation, the business                      */
/* ================================================================ */

const ROUTES = { '#/chat': 'chat', '#/business': 'business', '#/admin': 'admin' };
const HASH = { home: '#/', chat: '#/chat', business: '#/business', admin: '#/admin' };
const DASH = new Set(['business', 'admin']);      // full pages over the shader backdrop
const biz = mountBusiness($('#biz'), { getMetrics: () => client.snapshot().metrics, tooltip: $('#tooltip') });
const adm = mountAdmin($('#adm'), { client, onTokenCopied: () => haptic(6) });
$('#summary').hidden = false;
$('#biz').hidden = false;
$('#adm').hidden = false;

function go(r) {
  if (location.hash !== HASH[r] && !(r === 'home' && !location.hash)) history.pushState(null, '', HASH[r]);
  applyRoute();
}

function applyRoute() {
  let r = ROUTES[location.hash] ?? 'home';
  if ((r === 'business' && !canAct()) || (r === 'admin' && !canAdmin())) { history.replaceState(null, '', HASH.home); r = 'home'; }
  const prev = ui.route;
  ui.route = r;
  ['home', 'chat', 'business', 'admin'].forEach((k) => body.classList.toggle(k, k === r));
  body.classList.toggle('dash', DASH.has(r));
  setBackdrop(DASH.has(r), $('#shader'));
  $$('[data-route]').forEach((a) => {
    const on = a.dataset.route === r;
    a.classList.toggle('on', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  if (r === prev) return layout();
  $('#tooltip').hidden = true;
  if (r !== 'home') { setSummary(false); ui.holdHome = false; }
  if (DASH.has(r)) { setDetail(false); setPop(false); }
  if (r === 'business') { biz.render(); $('#biz').scrollTop = 0; }
  if (r === 'admin') { adm.open(); $('#adm').scrollTop = 0; }
  else if (prev === 'admin') adm.close();
  orbit.paused = DASH.has(r);
  if (r === 'chat') enterChat(prev == null);
  else if (prev === 'chat') feedInner.classList.remove('entering');
  if (ui.drawerOpen && !isWide()) closeDrawer();
  document.title = r === 'business' ? 'Ciel · ORION' : r === 'admin' ? 'Admin · ORION' : r === 'chat' ? 'Conversation · ORION' : 'ORION';
  layout();
  if (prev != null) haptic(5);
}
addEventListener('hashchange', applyRoute);
addEventListener('popstate', applyRoute);
$$('a[data-route]').forEach((a) => a.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  go(a.dataset.route);
}));

/* the feed rises in behind the message you just sent */
function enterChat(instant) {
  const kids = [...feedInner.children];
  kids.forEach((k, i) => k.style.setProperty('--i', String(Math.max(0, i - (kids.length - 8)))));
  feedInner.classList.remove('entering');
  if (!instant && !reduced.matches) {
    void feedInner.offsetWidth;
    feedInner.classList.add('entering');
    clearTimeout(ui.enterT);
    ui.enterT = setTimeout(() => feedInner.classList.remove('entering'), 1500);
  }
  feed.scrollTop = feed.scrollHeight;
  if (isWide() && document.activeElement !== input) setTimeout(() => ui.route === 'chat' && input.focus({ preventScroll: true }), 420);
}

/* ---------- while you were gone: plain text on the right ---------- */

const ASK = [
  ['How are the Ciel ads doing?', 'How are the ads doing?'],
  ['Research what hikers want as gifts this winter', 'Research gift ideas'],
  ['Help me plan the Black Friday launch', 'Plan Black Friday'],
];
const ASK_GUEST = [
  ['What’s the weather tomorrow?', 'Weather tomorrow'],
  ['Set a timer for 10 minutes', 'Set a timer'],
  ['Research something for me', 'Research something'],
];
/* ---------- the brief: ORION's "while you were gone", from the snapshot or a `brief` event ---------- */
// It usually arrives a few seconds after connecting; if not, ask once.
let briefTimer = 0;
function askForBrief() {
  clearTimeout(briefTimer);
  if (client.brief || account()?.features?.brief === false) return;
  ui.briefWaiting = true;
  briefTimer = setTimeout(() => {
    if (!client.brief) client.requestBrief();
    briefTimer = setTimeout(() => { ui.briefWaiting = false; renderSummary(); }, 20000);   // give up on the placeholder
  }, 6000);
}
client.on('brief', () => { clearTimeout(briefTimer); ui.briefWaiting = false; renderSummary(); });

/** The brief's text as paragraphs; list markers from the model are dropped. */
function briefHTML(b) {
  const paras = String(b.text ?? '').split(/\n+/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);
  return paras.map((p) => `<p>${esc(p)}</p>`).join('');
}

/* The brief lives behind a pill under the top bar. Its lamp is lit while there's something you haven't read. */
const SEEN_KEY = 'orion-brief-seen';
const seenAt = () => { try { return +localStorage.getItem(SEEN_KEY) || 0; } catch { return 0; } };
function setSummary(open) {
  ui.sumOpen = open && ui.route === 'home';
  body.classList.toggle('sum-open', ui.sumOpen);
  $('#sum-pill').setAttribute('aria-expanded', String(ui.sumOpen));
  if (ui.sumOpen) {
    const at = client.brief?.at;
    if (at) try { localStorage.setItem(SEEN_KEY, String(at)); } catch {}
    renderPill();
  }
}
function renderPill() {
  const b = client.brief;
  const fresh = b?.at && b.at > seenAt();
  const waiting = canAct() ? waitingCount() : 0;
  const pill = $('#sum-pill');
  pill.classList.toggle('lit', !!(fresh || waiting));
  pill.classList.toggle('busy', !!ui.briefWaiting && !b);
  $('#sum-pill-t').textContent = b?.at ? ago(b.at) : '';
}
$('#sum-pill').addEventListener('click', () => { setSummary(!ui.sumOpen); haptic(6); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sumOpen) { setSummary(false); $('#sum-pill').focus(); } });
addEventListener('pointerdown', (e) => {
  if (ui.sumOpen && !e.target.closest('#summary, #sum-pill')) setSummary(false);
}, true);

function renderSummary() {
  const s = client.snapshot();
  const b = s.brief?.text ? s.brief : null;
  const away = s.activity.filter((a) => ['tool', 'search', 'done', 'think'].includes(a.kind)).sort((a, b) => b.at - a.at).slice(0, b ? 3 : 4);
  const done = s.tasks.filter((t) => t.status === 'done').length;
  const h = new Date().getHours();
  const lead = b ? ''
    : ui.briefWaiting ? '<span class="sum-wait">putting your brief together</span>'
    : client.mode === 'mock' && canAct() ? `while you were gone I finished ${done} task${done === 1 ? '' : 's'} and kept an eye on Ciel.`
    : away.length ? 'here’s what I’ve been up to for you.'
    : canAct() ? 'nothing new since you were last here.' : 'ask me anything. I can research, calculate, check the weather and set timers.';
  $('#summary').innerHTML = `
    <h2 class="sum-hi">Hello ${esc(address())},</h2>
    ${b ? `<div class="sum-brief" title="Brief from ${esc(agoLong(b.at))}">${briefHTML(b)}<time>${esc(agoLong(b.at))}</time></div>` : `<p class="sum-lead">${lead}</p>`}
    <ol class="sum-list">${away.map((a, i) => `<li style="--i:${i}"><span class="t">${esc(a.title)}</span><time>${ago(a.at)}</time>${a.detail ? `<span class="d">${esc(a.detail)}</span>` : ''}</li>`).join('')}</ol>
    <p class="sum-flag" id="sum-flag"></p>
    <div class="sum-ask"><span>${h < 12 ? 'This morning, ask me' : 'Ask me'}</span>${(canAct() ? ASK : ASK_GUEST).map(([say, label]) => `<button data-say="${esc(say)}">${esc(label)}</button>`).join('')}</div>`;
  renderSummaryFlag();
  renderPill();
}
function renderSummaryFlag() {
  const el = $('#sum-flag');
  if (!el) return;
  const n = canAct() ? waitingCount() : 0;
  el.hidden = !n;
  el.innerHTML = n ? `<button data-sum="approvals">${n === 1 ? 'One approval is' : `${n} approvals are`} waiting for you</button>` : '';
  renderPill();
}
function placeSummary() {}             // the panel hangs from its pill now; kept for older callers
$('#summary').addEventListener('click', (e) => {
  const say = e.target.closest('[data-say]');
  if (say) {
    const r = say.getBoundingClientRect();
    ui.flyFrom = { left: r.left + 20, top: r.top };
    setSummary(false);
    return sendText(say.dataset.say);
  }
  if (e.target.closest('[data-sum=approvals]')) { setSummary(false); setPop(true); }
});

/* ================================================================ */
/* go                                                               */
/* ================================================================ */

autosize();
applyRoute();
client.connect();
setInterval(() => {
  if (tasksOpen()) renderTasks();
  if (ui.popOpen && !ui.decisions.size) renderApprovals();
}, 30000);
setInterval(() => { for (const h of ui.hourly.values()) { h.shift(); h.push(0); } }, 3600e3);

mountLab();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Debug handle for local testing only.
if (location.hostname === 'localhost') window.__leo = { client, ui, orbit, go };
