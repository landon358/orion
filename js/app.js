import { createLeoClient } from './leo-client.js';
import { LeoGraph, drawHub, GROUPS, SKILLS } from './graph.js';
import { mountBusiness } from './business.js';
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
const EXPLORE = { shopify: 'business', meta: 'business', gelato: 'business', planner: 'tasks', leo: 'vitals' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const client = createLeoClient();
const graph = new LeoGraph($('#graph'));
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
  view: 'graph',
  flowGroup: null,
  popOpen: false,
  drawerOpen: false,
  panel: 'activity',
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
// the light strands run through ORION: his hub in the network view, his orb in the flow view
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
    // the map keeps its framing on every page so nothing jumps when the column forms
    const sum = $('#summary').offsetWidth;
    const right = ui.detailOpen ? 400 : sum ? sum + 56 + 28 : 24;
    graph.setInsets({ top: topH + 6, bottom: ui.route === 'home' ? dockH + 30 + 52 : 150, left: 96, right });
    graph.setLine(ui.route === 'chat', lineBox());
    // the rings: centred in the open space on the ORION page; a small column on the left while chatting
    const box = ui.route === 'chat'
      ? { left: 20, top: topH + 36, width: 272, height: innerHeight - topH - 36 - 56 }
      : { left: 96, top: topH + 6, width: innerWidth - 96 - right, height: innerHeight - topH - 6 - (dockH + 40) };
    Object.assign($('#orbit').style, { left: `${box.left}px`, top: `${box.top}px`, width: `${Math.max(0, box.width)}px`, height: `${Math.max(0, box.height)}px` });
  } else {
    $('#orbit').removeAttribute('style');
    graph.setInsets({ top: 10, bottom: 36, left: 10, right: 10 });
    graph.setLine(false);
  }
  placeSummary();
  if (ui.view === 'flow') renderFlow();
}
function lineBox() {
  return { x: 156, top: $('#topbar').offsetHeight + 36, bottom: innerHeight - 56 };
}
new ResizeObserver(layout).observe($('#dock'));
addEventListener('resize', layout);
wideMQ.addEventListener('change', () => { setDetail(ui.detailOpen && isWide()); applyRoute(); graph.paused = true; });

/* ================================================================ */
/* client events                                                    */
/* ================================================================ */

client.on('connection', ({ status, mode }) => {
  const c = $('#conn');
  c.className = `conn ${status}`;
  c.setAttribute('aria-label', status === 'online' ? `Connected${mode === 'mock' ? ', demo data' : ''}` : status === 'connecting' ? 'Connecting' : 'Offline');
  if (status === 'online') {
    const s = client.snapshot();
    graph.setTools(s.tools);
    orbit.setTools(s.tools);
    s.tools.forEach(seedHourly);
    welcome();
    renderStats(); renderDetail();
    renderSummary();
    setDetail(false);
    if (ui.route === 'business') biz.render();
    layout();
  }
});

client.on('state', ({ state, label, detail }) => {
  ui.state = state; ui.stateLabel = label; ui.stateDetail = detail ?? '';
  graph.setState(state, label.toLowerCase());
  orbit.setState(state);
  $('#m-state').textContent = detail ? `${label} · ${detail}` : label;
  $('#composer').classList.toggle('busy', ['thinking', 'working', 'speaking'].includes(state));
  if (ACTIVE.has(state)) ui.lastJob = Date.now();
  voice.onLeoState(state);
  if (ui.turn && state === 'thinking' && !ui.turn.steps.length) setWorking(label);
  if (ui.view === 'flow') renderFlowState();
  if (ui.selected === 'leo') scheduleDetail();
});

client.on('audio', ({ amp }) => { graph.setLevel(amp); orbit.setLevel(amp); voice.leoAmp = amp; flowOrb.level = amp; });

client.on('tool', (e) => {
  graph.toolEvent(e);
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
  if (ui.view === 'flow' && ui.flowGroup === 'tools') scheduleFlow();
});

client.on('message', (m) => (m.role === 'user' ? addUserMessage(m) : upsertLeoMessage(m)));

client.on('activity', (a) => {
  if (ui.turn && ['tool', 'search', 'think'].includes(a.kind)) { ui.turn.steps.push(a.title); setWorking(`${a.title}…`); }
  if (ui.drawerOpen && ui.panel === 'activity') renderActivity();
  if (ui.selected === 'leo' || a.tool === ui.selected) scheduleDetail();
});

client.on('task', () => {
  if (ui.drawerOpen && ui.panel === 'tasks') renderTasks();
  renderStats();
  if (ui.view === 'flow') scheduleFlow();
  if (ui.selected === 'leo') scheduleDetail();
});

client.on('approval', (a) => {
  if (a.status === 'pending' && !ui.knownApprovals.has(a.id)) { ui.knownApprovals.add(a.id); bumpBadge(); }
  updateBadge(); renderApprovals(); renderStats(); renderSummaryFlag();
  if (ui.drawerOpen && ui.panel === 'tasks') renderTasks();
  if (ui.view === 'flow') scheduleFlow();
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
  if (ui.drawerOpen && ui.panel === 'vitals') updateVitals(v);
  if (ui.selected === 'leo') scheduleDetail();
});

client.on('notify', (n) => showBanner(n));

/* ================================================================ */
/* graph: select a node to see it in the detail panel               */
/* ================================================================ */

graph.onSelect = (id) => {
  if (id) { select(id); haptic(6); return; }
  // tapped empty space
  setDetail(false);
};

orbit.onSelect = (id) => { select(id); haptic(6); };

function select(id, { open = true } = {}) {
  ui.selected = id;
  graph.select(id);
  orbit.select(id);
  renderDetail();
  if (open) setDetail(true);
}

function setDetail(open) {
  ui.detailOpen = open;
  body.classList.toggle('detail-open', open);
  if (!isWide()) $('#scrim').classList.toggle('on', open || ui.drawerOpen);
  root.style.setProperty('--detail-drag', '0px');
  if (!open && ui.selected !== 'leo') { ui.selected = 'leo'; graph.select(isWide() ? 'leo' : null); orbit.select(null); }
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
  el.innerHTML = ui.selected === 'leo' ? leoDetail() : toolDetail(ui.selected);
  el.scrollTop = scroll;
  const tool = client.tools.find((t) => t.id === ui.selected);
  $('#crumb-text').textContent = tool
    ? `${GROUPS[tool.id] ?? 'Tool'} · ${tool.name} · ${tool.calls} calls today`
    : `ORION overview · ${client.vitals.model.split(' · ')[0]} on RTX 2070`;
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
    <p class="d-sub">Qwen 3.5 9B on an RTX 2070, always on</p>
    <div class="d-status">
      <div class="st-text"><span class="badge ${badge}">${esc(ui.stateLabel)}</span><br>Up <b>${uptime(v.uptime)}</b> · last job <b>${agoLong(ui.lastJob)}</b></div>
      <button class="explore" data-explore="vitals">Explore details ${ICON.chev}</button>
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
      ${cell(ICON.bolt, `${v.tps ? v.tps.toFixed(0) : 0}<small>tok/s</small>`, 'Generation speed')}
      ${cell(ICON.chip, `${v.vram.toFixed(1)}<small>/ ${v.vramTotal} GB</small>`, 'VRAM in use')}
    </div>
    <div class="notes-head">${ICON.notes}Recent work</div>
    ${notesFor('leo')}`;
}

function toolDetail(id) {
  const t = client.tools.find((x) => x.id === id);
  if (!t) return '';
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
    metric = { label: 'Orders, 7 days', val: k.orders7d, unit: '', d: prev ? ((k.orders7d - prev) / prev) * 100 : null, dl: 'vs prior week', badge: 'Sample data', values: days.map((d) => d.orders), warm: true };
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
    <div class="d-kicker">${ICON[id] ?? ICON.tool}<span>${esc(GROUPS[id] ?? 'Tool')}</span></div>
    <h2 class="d-title">${esc(t.name)}</h2>
    <p class="d-sub">${esc(t.desc)}</p>
    <div class="d-status">
      <div class="st-text"><span class="badge ${live ? '' : 'idle'}">${live ? 'In use now' : 'Ready'}</span><br>Last called <b>${agoLong(t.lastUsed)}</b></div>
      <button class="explore" data-explore="${EXPLORE[id] ?? 'activity'}">Explore details ${ICON.chev}</button>
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
      ${cell(ICON.skills, (SKILLS[id] ?? []).length, esc((SKILLS[id] ?? []).join(' and ')))}
    </div>
    <div class="notes-head">${ICON.notes}What ORION did with it</div>
    ${notesFor(id)}`;
}

$('#detail-body').addEventListener('click', (e) => {
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
  if (ui.route !== 'chat') go('chat');
  const el = document.createElement('div');
  el.className = 'msg user';
  if (m.voice) el.innerHTML = `<span class="voice-tag">${ICON.mic}said aloud</span><br>`;
  el.append(document.createTextNode(m.text));
  feedInner.append(el);
  const w = document.createElement('div');
  w.className = 'working';
  w.innerHTML = '<span class="spin" aria-hidden="true"></span><span class="w-label">Thinking…</span>';
  feedInner.append(w);
  ui.turn = { el: w, steps: [], tools: new Set() };
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
      : `<span class="meta">${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>`;
    el.innerHTML = `<div class="msg-head"><span class="bracket" aria-hidden="true"></span><span class="who">ORION</span>${meta}</div><div class="body"></div>${steps.length ? `<ul class="steps-list">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}`;
    $('button.meta', el)?.addEventListener('click', (e) => e.currentTarget.setAttribute('aria-expanded', String(el.classList.toggle('open'))));
    ui.lastLeo?.classList.remove('live');
    el.classList.add('live');
    ui.lastLeo = el;
    feedInner.append(el);
    ui.messages.set(m.id, el);
  }
  const grew = m.text.length - ($('.body', el).textContent.length || 0);
  $('.body', el).textContent = m.text;
  if (m.streaming && grew > 0) orbit.talk(Math.min(1, 0.5 + grew / 24));
  el.classList.toggle('streaming', !!m.streaming);
  el.classList.toggle('interrupted', !!m.interrupted);
  scrollToEnd();
}

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
    text: `${greet}. While you were away I finished ${done} tasks and kept an eye on Ciel.${pending ? ` ${pending === 1 ? 'One approval is' : `${pending} approvals are`} waiting under the bell.` : ''}`,
  });
  updateBadge();
}

/* ================================================================ */
/* dock: stats, ask, chips                                          */
/* ================================================================ */

const STATS = [
  { id: 'tps', label: 'Generation', icon: ICON.bolt, open: 'vitals' },
  { id: 'gpu', label: 'GPU load', icon: ICON.chip, open: 'vitals' },
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
playIntro({ brand: $('#brand'), force: new URLSearchParams(location.search).has('intro') });

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
  if (!text) return;
  const r = input.getBoundingClientRect(), cs = getComputedStyle(input);
  ui.flyFrom = { left: r.left + parseFloat(cs.paddingLeft), top: r.top + parseFloat(cs.paddingTop) };
  input.value = '';
  autosize();
  sendText(text);
});
function sendText(text) {
  if (ui.route !== 'chat') go('chat');
  client.send(text);
}
const newTask = () => {
  input.value = 'Add a task: ';
  autosize();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
};
$('#btn-new-task').addEventListener('click', newTask);
$('#btn-plus').addEventListener('click', newTask);

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
  if (ui.drawerOpen && ui.panel === 'tasks') renderTasks();
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
/* view switch + flow view                                          */
/* ================================================================ */

$$('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
function setView(v) {
  ui.view = v;
  $$('[data-view]').forEach((b) => { const on = b.dataset.view === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  $('#flow').hidden = v !== 'flow';
  $('#graph').style.visibility = v === 'flow' ? 'hidden' : '';
  graph.paused = true;
  ['#btn-zoom-in', '#btn-zoom-out', '#btn-fit'].forEach((s) => { $(s).disabled = v === 'flow'; $(s).style.opacity = v === 'flow' ? 0.4 : ''; });
  if (v === 'flow') { renderFlow(); flowOrb.start(); } else flowOrb.stop();
}
$('#btn-zoom-in').addEventListener('click', () => graph.zoomBy(1.25));
$('#btn-zoom-out').addEventListener('click', () => graph.zoomBy(0.8));
$('#btn-fit').addEventListener('click', () => graph.fit());

const FLOW_GROUPS = [
  { id: 'running', label: 'Running now', icon: ICON.play },
  { id: 'needs', label: 'Waiting on you', icon: ICON.bell },
  { id: 'queued', label: 'Queued', icon: ICON.clock },
  { id: 'done', label: 'Done today', icon: ICON.check },
  { id: 'tools', label: 'Tools', icon: ICON.network },
];

function flowItems(g) {
  const s = client.snapshot();
  const task = (t) => ({
    key: t.id, title: t.title, pill: ['Src', t.source.split(' ')[0]],
    bars: t.status === 'done' ? 'ggg' : t.status === 'rejected' ? 'r--' : t.status === 'running' ? (t.progress > 0.6 ? 'gga' : t.progress > 0.3 ? 'ga-' : 'a--') : '---',
    act: { drawer: 'tasks' },
  });
  if (g === 'running') return s.tasks.filter((t) => t.status === 'running').map(task);
  if (g === 'queued') return s.tasks.filter((t) => t.status === 'queued').map(task);
  if (g === 'done') return s.tasks.filter((t) => t.status === 'done' || t.status === 'rejected').sort((a, b) => b.updatedAt - a.updatedAt).map(task);
  if (g === 'needs') return s.approvals.filter((a) => a.status === 'pending').map((a) => ({ key: a.id, title: a.title, pill: ['Src', a.source.split(' ')[0]], bars: 'rr-', act: { approval: a.id } }));
  return [...s.tools].sort((a, b) => b.calls - a.calls).map((t) => ({
    key: t.id, title: t.name, pill: ['Calls', t.calls],
    bars: Date.now() - t.lastUsed < 120e3 ? 'ggg' : Date.now() - t.lastUsed < 30 * 60e3 ? 'gg-' : 'g--',
    act: { tool: t.id },
  }));
}

let flowQueued = false;
function scheduleFlow() {
  if (flowQueued) return;
  flowQueued = true;
  requestAnimationFrame(() => { flowQueued = false; if (ui.view === 'flow') renderFlow(); });
}

function renderFlow() {
  const stage = $('#stage').getBoundingClientRect();
  const W = stage.width, H = stage.height;
  const wide = isWide();
  const top = wide ? $('#topbar').offsetHeight + 10 : 10;
  const bottom = wide ? $('#dock').offsetHeight + 30 + 52 : 20;
  const left = wide ? 100 : 10;
  const right = wide ? (ui.detailOpen ? 400 : 30) : 10;
  const cy = top + (H - top - bottom) / 2;
  ui.flowCy = cy;
  const scale = Math.min(1, (W - left - right) / 860);
  const ox = left + 150 * scale;
  const chipX = ox + 200 * scale + 40;
  const s = client.snapshot();
  const counts = {
    running: s.tasks.filter((t) => t.status === 'running').length,
    needs: s.approvals.filter((a) => a.status === 'pending').length,
    queued: s.tasks.filter((t) => t.status === 'queued').length,
    done: s.tasks.filter((t) => t.status === 'done' || t.status === 'rejected').length,
    tools: s.tools.length,
  };
  if (!ui.flowGroup) ui.flowGroup = counts.running ? 'running' : 'tools';

  const orb = $('#flow-orb');
  orb.style.left = `${ox}px`; orb.style.top = `${cy}px`;
  orb.style.transform = `translate(-50%, -50%) scale(${Math.max(0.7, scale)})`;
  $('#fo-model').textContent = client.vitals.model.split(' · ')[0];
  $('#fo-queue').textContent = counts.queued + counts.running;
  renderFlowState();

  const chips = $('#flow-chips');
  chips.style.left = `${chipX}px`; chips.style.top = `${cy}px`;
  chips.innerHTML = FLOW_GROUPS.map((g) => `<button class="fchip ${g.id === ui.flowGroup ? 'on' : ''}" role="tab" aria-selected="${g.id === ui.flowGroup}" data-group="${g.id}"><span class="fc-top">${g.icon}<span class="fc-n">${counts[g.id]}</span></span><span class="fc-l">${g.label}</span></button>`).join('');

  // items on an arc around ORION
  const items = flowItems(ui.flowGroup).slice(0, 14);
  const R = Math.max(chipX + 168 + 110 - ox, Math.min(W - right - 270 - ox, 560));
  const availH = H - top - bottom - 30;
  const n = items.length;
  const spacing = Math.min(46, n > 1 ? availH / (n - 1) : 0);
  const chipEls = $$('.fchip', chips);
  const chipRects = chipEls.map((c) => c.getBoundingClientRect());
  const selIdx = FLOW_GROUPS.findIndex((g) => g.id === ui.flowGroup);
  const sr = chipRects[selIdx];
  const sx = sr.right - stage.left, sy = sr.top + sr.height / 2 - stage.top;

  let lines = '<defs><linearGradient id="fl" x1="0" x2="1"><stop offset="0" stop-color="rgba(245,230,195,0.85)"/><stop offset="1" stop-color="rgba(245,230,195,0.25)"/></linearGradient></defs>';
  chipRects.forEach((r, i) => {
    const x2 = r.left - stage.left, y2 = r.top + r.height / 2 - stage.top;
    const x1 = ox + 95 * Math.max(0.7, scale), y1 = cy + 10;
    lines += `<path d="M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}" fill="none" stroke="${i === selIdx ? 'rgba(245,230,195,0.6)' : 'rgba(240,230,210,0.18)'}" stroke-width="1"/>`;
  });
  const BEADS = ['255,232,170', '255,255,255', '240,205,140', '255,255,255'];
  const itemHtml = items.map((it, i) => {
    const off = (i - (n - 1) / 2) * spacing;
    const th = Math.asin(Math.max(-0.95, Math.min(0.95, off / R)));
    const x = ox + Math.cos(th) * R, y = cy + off;
    lines += `<path d="M${sx},${sy} C${sx + 90},${sy} ${x - 140},${y} ${x},${y}" fill="none" stroke="url(#fl)" stroke-width="1.1" opacity="${0.35 + 0.65 * (1 - Math.abs(off) / (availH / 2 + 1))}"/>`;
    const glow = i < 4 ? BEADS[i] : '230,225,210';
    lines += `<circle cx="${x}" cy="${y}" r="${i < 4 ? 3 : 2}" fill="rgb(${glow})"${i < 4 ? ` style="filter:drop-shadow(0 0 5px rgb(${glow}))"` : ''}/>`;
    const far = Math.abs(off) > availH * 0.42;
    return `<button class="fitem ${far ? 'far' : ''}" style="left:${x}px;top:${y}px" data-item="${i}"><span class="fi-t">${esc(it.title)}</span><span class="fi-m"><span class="mpill"><b>${esc(it.pill[0])}</b>${esc(String(it.pill[1]))}</span><span class="bars3">${[...it.bars].map((c) => `<i class="${c === '-' ? '' : c}"></i>`).join('')}</span></span></button>`;
  }).join('');
  $('#flow-lines').innerHTML = lines;
  $('#flow-items').innerHTML = itemHtml || `<div class="flow-empty" style="left:${sx + 60}px;top:${sy}px">Nothing here right now.</div>`;
  $('#flow-items').onclick = (e) => {
    const b = e.target.closest('[data-item]');
    if (!b) return;
    const act = items[+b.dataset.item].act;
    if (act.drawer) openDrawer(act.drawer);
    else if (act.approval) { ui.expanded.add(act.approval); setPop(true); }
    else if (act.tool) { setView('graph'); select(act.tool); }
  };
}
$('#flow-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-group]');
  if (!b) return;
  ui.flowGroup = b.dataset.group;
  haptic(5);
  renderFlow();
});

function renderFlowState() {
  const st = ui.state;
  const lit = st === 'needs-you' ? 'alert' : ACTIVE.has(st) ? 'on' : '';
  const n = { idle: 1, listening: 2, thinking: 3, working: 4, speaking: 3, 'needs-you': 4 }[st] ?? 0;
  $('#fo-state').innerHTML = Array.from({ length: 4 }, (_, i) => `<i class="${i < n ? lit || 'on' : ''}"></i>`).join('');
}

const flowOrb = {
  raf: 0, level: 0, t: 0,
  start() {
    const cv = $('#flow-canvas');
    const ctx = cv.getContext('2d');
    let last = performance.now();
    const fx = { glow: 0.7 };
    const loop = (now) => {
      this.t += (now - last) / 1000; last = now;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const st = ui.state;
      drawHub(ctx, W / 2, H / 2, 36, this.t, {
        halo: 0.55,
        ...fx, think: st === 'thinking' ? 1 : st === 'working' ? 0.5 : 0, alert: st === 'needs-you' ? 1 : 0,
        spin: ACTIVE.has(st) ? 1.6 : 1, level: this.level, still: matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  },
  stop() { cancelAnimationFrame(this.raf); },
};

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
    graph.setLevel(0); orbit.setLevel(0); flowOrb.level = 0;
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
      if (client.state === 'listening') { graph.setLevel(this.micLevel); orbit.setLevel(this.micLevel * 0.6); flowOrb.level = this.micLevel; }
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
/* phone: expand the map header                                     */
/* ================================================================ */

$('#btn-map').addEventListener('click', () => {
  const full = body.classList.toggle('map-full');
  $('#btn-map').setAttribute('aria-pressed', String(full));
  $('#btn-map').setAttribute('aria-label', full ? 'Shrink map' : 'Expand map');
  graph.userMoved = false;
});

/* ================================================================ */
/* dashboards drawer                                                */
/* ================================================================ */

const drawer = $('#drawer');
const PANELS = ['activity', 'tasks', 'vitals'];
const TITLES = { activity: 'Activity', tasks: 'Tasks', vitals: 'Vitals' };

function openDrawer(panel = ui.panel) {
  selectPanel(panel);
  ui.drawerOpen = true;
  $$('[data-open]').forEach((b) => b.classList.toggle('on', b.dataset.open === ui.panel));
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('on');
  setPop(false);
  haptic(6);
  setTimeout(() => $('#btn-drawer-close').focus({ preventScroll: true }), 50);
}
function closeDrawer() {
  ui.drawerOpen = false;
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
  if (ui.popOpen) setPop(false);
  else if (ui.drawerOpen) closeDrawer();
  else if (ui.detailOpen) setDetail(false);
  else if (ui.route === 'chat' && document.activeElement !== input) go('home');
  else if (ui.route === 'chat') input.blur();
});

function selectPanel(p) {
  ui.panel = p;
  $('#drawer-title').textContent = TITLES[p];
  $$('#segmented [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.panel === p)));
  $('#seg-thumb').style.transform = `translateX(${PANELS.indexOf(p) * 100}%)`;
  $$('.panel').forEach((el) => { el.hidden = el.dataset.panel !== p; });
  renderPanel();
}
$('#segmented').addEventListener('click', (e) => { const p = e.target.closest('[data-panel]')?.dataset.panel; if (p) selectPanel(p); });

function renderPanel() {
  ({ activity: renderActivity, tasks: renderTasks, vitals: renderVitals })[ui.panel]();
}

function renderActivity() {
  const s = client.snapshot();
  const busy = ACTIVE.has(s.state);
  $('#panel-activity').innerHTML = `
    <div class="now-card">
      <span class="sphere hub" aria-hidden="true"></span>
      <div><div class="t1">${esc(ui.stateLabel)}</div><div class="t2">${esc(ui.stateDetail || (busy ? 'Working…' : 'Waiting for the next job'))}</div></div>
    </div>
    <div class="group">
      ${[...s.activity].sort((a, b) => b.at - a.at).slice(0, 40).map((a, i) => `
        <div class="tl-item k-${a.kind} ${i === 0 && busy ? 'now' : ''}">
          <span class="tl-icon">${ICON[a.kind] ?? ICON.tool}</span>
          <div><div class="tl-title">${esc(a.title)}</div>${a.detail ? `<div class="tl-detail">${esc(a.detail)}</div>` : ''}</div>
          <span class="tl-time">${ago(a.at)}</span>
        </div>`).join('')}
    </div>`;
}

function renderTasks() {
  const s = client.snapshot();
  const cols = [['needs-you', 'Needs you'], ['running', 'Running'], ['queued', 'Queued'], ['done', 'Done']];
  const byStatus = (st) => s.tasks.filter((t) => (st === 'done' ? t.status === 'done' || t.status === 'rejected' : t.status === st)).sort((a, b) => b.updatedAt - a.updatedAt);
  $('#panel-tasks').innerHTML = `<div class="board">${cols.map(([key, name]) => {
    const all = byStatus(key);
    const list = all.slice(0, key === 'done' ? 8 : 20);
    return `<section class="col ${key}">
      <div class="col-head"><span class="dot"></span>${name}<span class="count">${all.length}</span></div>
      <div class="col-cards">${list.length ? list.map((t) => taskCard(t, s)).join('') : `<div class="empty">${key === 'needs-you' ? 'Nothing waiting on you' : 'Empty'}</div>`}</div>
    </section>`;
  }).join('')}</div>`;
}

function taskCard(t, s) {
  const ap = s.approvals.find((a) => a.id === t.id && a.status === 'pending');
  return `<div class="task ${t.status}">
    <div class="t-title">${esc(t.title)}</div>
    <div class="t-meta">${esc(t.source)}${t.status === 'rejected' ? ' · rejected' : ''} · ${ago(t.updatedAt)}</div>
    ${t.status === 'running' ? `<div class="bar"><span style="width:${Math.round((t.progress || 0) * 100)}%"></span></div>` : ''}
    ${ap ? (ui.decisions.has(ap.id) ? undoBar(ap.id) : `<div class="t-actions"><button class="btn secondary" data-reject="${ap.id}">Reject</button><button class="btn primary" data-approve="${ap.id}">Approve</button></div>`) : ''}
  </div>`;
}
$('#panel-tasks').addEventListener('click', onDecisionClick);

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

$('#drawer-body').addEventListener('scroll', () => { $('#tooltip').hidden = true; }, { passive: true });

function gauge(id, label) {
  const C = 2 * Math.PI * 30;
  return `<div class="gauge">
    <svg viewBox="0 0 76 76" aria-hidden="true">
      <circle class="g-track" cx="38" cy="38" r="30" fill="none"/>
      <circle class="g-fill" id="g-${id}" cx="38" cy="38" r="30" fill="none" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 38 38)"/>
      <text class="g-val" id="gv-${id}" x="38" y="43" text-anchor="middle">—</text>
    </svg>
    <div class="g-label">${label}</div><div class="g-sub" id="gs-${id}"></div>
  </div>`;
}

function renderVitals() {
  const v = client.snapshot().vitals;
  $('#panel-vitals').innerHTML = `
    <div class="gauges">${gauge('gpu', 'GPU')}${gauge('vram', 'VRAM')}${gauge('temp', 'Temp')}</div>
    <div class="chart-card">
      <div class="c-title" id="tps-now">— tokens/sec</div>
      <div class="c-sub">Generation speed, last 60 seconds</div>
      <div id="tps-spark"></div>
    </div>
    <div class="group rows">
      <div class="row"><span>GPU</span><span class="v">RTX 2070 · 8 GB</span></div>
      <div class="row"><span>Model</span><span class="v">${esc(v.model)}</span></div>
      <div class="row"><span>Uptime</span><span class="v" id="vit-uptime"></span></div>
      <div class="row"><span>Tasks queued</span><span class="v" id="vit-queue"></span></div>
      <div class="row"><span>Voice</span><span class="v">Whisper + Kokoro on CPU</span></div>
      <div class="row"><span>Connection</span><span class="v">${client.mode === 'mock' ? 'Demo data' : 'Tailscale'}</span></div>
    </div>
    <div class="group rows">
      ${[...client.snapshot().tools].sort((a, b) => b.lastUsed - a.lastUsed).map((t) => `<div class="row"><span>${esc(t.name)}</span><span class="v">${t.calls} calls · ${ago(t.lastUsed)}</span></div>`).join('')}
    </div>`;
  updateVitals(v);
}

function updateVitals(v) {
  if (!$('#g-gpu')) return;
  const C = 2 * Math.PI * 30;
  const set = (id, frac, val, sub) => {
    $(`#g-${id}`).style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, frac))));
    $(`#gv-${id}`).textContent = val;
    $(`#gs-${id}`).textContent = sub;
  };
  set('gpu', v.gpu / 100, `${v.gpu}%`, 'load');
  set('vram', v.vram / v.vramTotal, v.vram.toFixed(1), `of ${v.vramTotal} GB`);
  set('temp', (v.temp - 30) / 55, `${v.temp}°`, 'celsius');
  $('#tps-now').textContent = `${v.tps.toFixed(1)} tokens/sec`;
  $('#tps-spark').innerHTML = sparkline(ui.tpsHistory, { w: 300, h: 60 }).replace('class="spark"', 'class="spark" style="height:60px"');
  $('#vit-uptime').textContent = `${uptime(v.uptime)} ${Math.floor((v.uptime % 3600) / 60)}m`;
  $('#vit-queue').textContent = v.queue;
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
      else openDrawer(n.target?.panel ?? 'activity');
      return;
    }
    if (y + project(vel) < -40) dismiss(vel);
    else { run(0, vel); timer = setTimeout(() => dismiss(), 4000); }
  });
}

/* ================================================================ */
/* pages: ORION, the conversation, the business                      */
/* ================================================================ */

const ROUTES = { '#/chat': 'chat', '#/business': 'business' };
const HASH = { home: '#/', chat: '#/chat', business: '#/business' };
const biz = mountBusiness($('#biz'), { getMetrics: () => client.snapshot().metrics, tooltip: $('#tooltip') });
$('#summary').hidden = false;
$('#biz').hidden = false;

function go(r) {
  if (location.hash !== HASH[r] && !(r === 'home' && !location.hash)) history.pushState(null, '', HASH[r]);
  applyRoute();
}

function applyRoute() {
  const r = ROUTES[location.hash] ?? 'home';
  const prev = ui.route;
  ui.route = r;
  ['home', 'chat', 'business'].forEach((k) => body.classList.toggle(k, k === r));
  $$('[data-route]').forEach((a) => {
    const on = a.dataset.route === r;
    a.classList.toggle('on', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  if (r === prev) return layout();
  $('#tooltip').hidden = true;
  if (r === 'chat' && ui.view === 'flow') setView('graph');
  if (r !== 'home' && ui.view === 'flow') setView('graph');
  if (r === 'business') { setDetail(false); setPop(false); biz.render(); $('#biz').scrollTop = 0; }
  graph.paused = true;                    // the rings (orbit.js) stand in for the network now
  orbit.paused = r === 'business';
  if (r === 'chat') enterChat(prev == null);
  else if (prev === 'chat') feedInner.classList.remove('entering');
  if (ui.drawerOpen && !isWide()) closeDrawer();
  document.title = r === 'business' ? 'Ciel · ORION' : r === 'chat' ? 'Conversation · ORION' : 'ORION';
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
function renderSummary() {
  const s = client.snapshot();
  const away = s.activity.filter((a) => ['tool', 'search', 'done', 'think'].includes(a.kind)).sort((a, b) => b.at - a.at).slice(0, 4);
  const done = s.tasks.filter((t) => t.status === 'done').length;
  const h = new Date().getHours();
  $('#summary').innerHTML = `
    <h2 class="sum-hi">Hello sir,</h2>
    <p class="sum-lead">while you were gone I finished ${done} task${done === 1 ? '' : 's'} and kept an eye on Ciel.</p>
    <ol class="sum-list">${away.map((a, i) => `<li style="--i:${i}"><span class="t">${esc(a.title)}</span><time>${ago(a.at)}</time>${a.detail ? `<span class="d">${esc(a.detail)}</span>` : ''}</li>`).join('')}</ol>
    <p class="sum-flag" id="sum-flag"></p>
    <div class="sum-ask"><span>${h < 12 ? 'This morning, ask me' : 'Ask me'}</span>${ASK.map(([say, label]) => `<button data-say="${esc(say)}">${esc(label)}</button>`).join('')}</div>`;
  renderSummaryFlag();
  layout();
}
function renderSummaryFlag() {
  const el = $('#sum-flag');
  if (!el) return;
  const n = waitingCount();
  el.hidden = !n;
  el.innerHTML = n ? `<button data-sum="approvals">${n === 1 ? 'One approval is' : `${n} approvals are`} waiting for you</button>` : '';
  placeSummary();
}
function placeSummary() {
  const el = $('#summary');
  if (!isWide() || !el.offsetHeight) return;
  const topH = $('#topbar').offsetHeight, dockH = $('#dock').offsetHeight;
  const lo = topH + 16, hi = innerHeight - dockH - 40 - el.offsetHeight;
  const mid = (topH + innerHeight - dockH - 30) / 2 - el.offsetHeight / 2;
  el.style.setProperty('--sum-top', `${Math.round(Math.max(lo, Math.min(hi, mid)))}px`);
}
$('#summary').addEventListener('click', (e) => {
  const say = e.target.closest('[data-say]');
  if (say) {
    const r = say.getBoundingClientRect();
    ui.flyFrom = { left: r.left + 20, top: r.top };
    return sendText(say.dataset.say);
  }
  if (e.target.closest('[data-sum=approvals]')) setPop(true);
});

/* ================================================================ */
/* go                                                               */
/* ================================================================ */

selectPanel('activity');
autosize();
applyRoute();
client.connect();
setInterval(() => {
  if (ui.drawerOpen && ui.panel === 'activity') renderActivity();
  if (ui.popOpen && !ui.decisions.size) renderApprovals();
}, 30000);
setInterval(() => { for (const h of ui.hourly.values()) { h.shift(); h.push(0); } }, 3600e3);

mountLab();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Debug handle for local testing only.
if (location.hostname === 'localhost') window.__leo = { client, graph, ui, orbit, go };
