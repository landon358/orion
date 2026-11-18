/*
 * ORION client — the single seam between the UI and ORION's server.
 *
 * Everything the UI knows about ORION arrives as events from this object, and
 * everything the UI asks of ORION goes through its methods. Today it's a mock
 * that fakes an always-on agent. Later, a RealLeoClient (WebSocket/SSE to the
 * ORION box) implements the same methods and emits the same events, and nothing
 * else in the UI has to change. RealLeoClient (bottom of this file) is that live
 * client; ORION-PROTOCOL.md is the wire format the server has to speak.
 */

/**
 * The demo's tools: the same 10 bands the real ORION sends in its snapshot, innermost
 * first. `ring`/`phase` are leftovers from the old network map and unused; the UI
 * never assumes this list, it renders whatever `tools` ORION sends.
 */
export const TOOLS = [
  { id: 'memory',  name: 'Memory',     ring: 0, phase: 0.10, desc: 'What ORION remembers about you, Ciel, and past work' },
  { id: 'planner', name: 'Planner',    ring: 0, phase: 0.60, desc: 'Tasks, reminders, and follow-ups' },
  { id: 'web',     name: 'Web',        ring: 1, phase: 0.28, desc: 'Search and read pages' },
  { id: 'files',   name: 'Files',      ring: 1, phase: 0.78, desc: 'The ORION machine’s file system' },
  { id: 'voice',   name: 'Voice',      ring: 2, phase: 0.05, desc: 'Whisper hears you, Kokoro speaks' },
  { id: 'email',   name: 'Email',      ring: 2, phase: 0.48, desc: 'Reads and drafts mail; sending needs your OK' },
  { id: 'meta',    name: 'Meta Ads',   ring: 3, phase: 0.33, desc: 'Ciel ad spend, results, creatives' },
  { id: 'clarity', name: 'Clarity',    ring: 3, phase: 0.83, desc: 'Session replays and heatmaps for the Ciel site' },
  { id: 'github',  name: 'GitHub',     ring: 3, phase: 0.58, desc: 'Repos, issues and pushes' },
  { id: 'printer', name: 'Printer',    ring: 3, phase: 0.08, desc: 'The printer on the PC' },
];

export const STATES = ['idle', 'listening', 'thinking', 'working', 'speaking', 'needs-you', 'sleeping', 'error'];

class Emitter {
  #h = new Map();
  on(type, fn) { (this.#h.get(type) ?? this.#h.set(type, new Set()).get(type)).add(fn); return () => this.#h.get(type)?.delete(fn); }
  emit(type, data) { this.#h.get(type)?.forEach((fn) => fn(data)); this.#h.get('*')?.forEach((fn) => fn(type, data)); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- sample data (clearly fake; for the mockup only) ---------- */

/**
 * A pretend admin view for the demo (ACCOUNTS.md §6): the owner plus three friends,
 * each with a room. Shapes follow the spec; budget/routines/heartbeat/integrations
 * are undocumented there, so these are plausible guesses the page renders defensively.
 */
function sampleAdmin() {
  const now = Date.now();
  const m = 60e3, h = 3600e3;
  const acc = (id, name, role, o) => ({ id, name, role, address: '', budget_usd: role === 'owner' ? null : 0.1, cloud_mode: 'local', ...o });
  const accounts = [
    acc('u_owner', 'Landon', 'owner', { online: true, state: 'idle', watch_items: 3, facts: 214, pending_approvals: 1, allowance_left_usd: null, last_seen: now, address: 'sir', cloud_mode: 'local+' }),
    acc('u_maya', 'Maya', 'guest', { online: true, state: 'thinking', watch_items: 2, facts: 31, pending_approvals: 0, allowance_left_usd: 0.07, last_seen: now - 2 * m, cloud_mode: 'local+' }),
    acc('u_theo', 'Theo', 'guest', { online: false, state: 'idle', watch_items: 1, facts: 12, pending_approvals: 0, allowance_left_usd: 0.1, last_seen: now - 5 * h }),
    acc('u_jules', 'Jules', 'guest', { online: false, state: 'idle', watch_items: 0, facts: 4, pending_approvals: 0, allowance_left_usd: 0, last_seen: now - 3 * 86400e3 }),
  ];
  const act = (kind, title, detail, ago) => ({ id: uid('a'), kind, title, detail, at: now - ago });
  const rooms = {
    u_owner: { name: 'Landon', role: 'owner', online: true, state: 'idle', approvals: 1, tasks: 4, watch: 3, brief: true,
      activity: [act('done', 'Sent morning briefing', '2 orders overnight', 6 * h), act('tool', 'Read 3 new reviews', 'All 5★', 3 * h), act('search', 'Searched “topographic map gifts”', '8 sources', 2 * h), act('think', 'Heartbeat', 'Order #1043 hasn’t shipped after 3 days', 40 * m)] },
    u_maya: { name: 'Maya', role: 'guest', online: true, state: 'thinking', approvals: 0, tasks: 1, watch: 2, brief: true,
      activity: [act('search', 'Searched “best trail running shoes 2026”', '6 sources', 9 * m), act('done', 'Timer: pasta', '10 minutes', 50 * m), act('think', 'Heartbeat', 'Nothing new on the race sign-up page', 2 * h), act('tool', 'Saved a fact', 'Training for the Squamish 50k', 26 * h)] },
    u_theo: { name: 'Theo', role: 'guest', online: false, state: 'idle', approvals: 0, tasks: 0, watch: 1, brief: false,
      activity: [act('search', 'Read a page', 'How to re-pot a fiddle leaf fig', 5 * h), act('done', 'Brief', 'Rain on Thursday', 20 * h)] },
    u_jules: { name: 'Jules', role: 'guest', online: false, state: 'idle', approvals: 0, tasks: 0, watch: 0, brief: false,
      activity: [act('rejected', 'Cloud allowance used up', 'Answers stay local now', 3 * 86400e3)] },
  };
  const audit = [
    ['Landon', 'email', 'medium', 'approved', 22 * m], ['Maya', 'web', 'low', 'ok', 9 * m], ['Landon', 'files', 'low', 'ok', 2 * h],
    ['Landon', 'meta', 'low', 'ok', 3 * h], ['Theo', 'web', 'low', 'ok', 5 * h], ['Maya', 'files', 'high', 'blocked', 7 * h],
    ['Landon', 'printer', 'medium', 'approved', 9 * h], ['Jules', 'web', 'low', 'ok', 3 * 86400e3],
  ].map(([user, tool, risk, outcome, ago]) => ({ ts: now - ago, user, tool, risk, outcome })).sort((a, b) => b.ts - a.ts);
  return {
    accounts, rooms, audit,
    budget: { cap_usd: 5, spent_usd: 0.8, remaining_usd: 4.2, today_usd: 0.31, by_account: { Landon: 0.69, Maya: 0.03, Theo: 0, Jules: 0.1 } },
    routines: [
      { name: 'morning_brief', at: '07:00', last_run: now - 6 * h, ok: true },
      { name: 'ciel_orders', every: '2h', last_run: now - 40 * m, ok: true },
      { name: 'memory_inbox', every: '6h', last_run: now - 5 * h, ok: false },
    ],
    heartbeat: { every_minutes: 30, last: now - 12 * m, next: now + 18 * m, checks_today: 31, alerts_today: 2 },
    integrations: { email: 'connected', meta: 'connected', github: 'connected', clarity: 'connected', printer: 'offline', shopify: 'not set up' },
    telemetry: { today: { turns: 46, by_tier: { local: 39, haiku: 6, sonnet: 1 }, avg_ms: 3400, cost_usd: 0.083, retries: 2, escalations: 3, withdrawals: 1, fastpath: 11 } },
    safe_mode: false,
    cloud_master: true, cloud_configured: true,
    at: now,
  };
}

function sampleMetrics() {
  const days = [];
  const now = new Date();
  // 60 days so every range (7 / 14 / 30) has a previous period to compare against
  for (let i = 59; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const lift = i < 10 ? 0.6 : i < 30 ? 0.25 : 0;
    const orders = Math.max(0, Math.round(rand(-0.6, 1.4) + lift));
    const spend = Math.round(rand(28, 52));
    const sessions = Math.round(rand(140, 260) + lift * 90);
    const studio = Math.round(sessions * rand(0.26, 0.36));
    const carts = Math.max(orders, Math.round(studio * rand(0.12, 0.2)));
    const checkouts = Math.max(orders, Math.round(carts * rand(0.4, 0.6)));
    days.push({ date: d.toISOString().slice(0, 10), orders, revenue: orders * Math.round(rand(52, 74)), spend, sessions, studio, carts, checkouts });
  }
  const last7 = days.slice(-7);
  const sum = (k, arr = last7) => arr.reduce((s, d) => s + d[k], 0);
  const orders = sum('orders');
  return {
    sample: true,
    updatedAt: Date.now(),
    days,
    kpis: {
      revenue7d: sum('revenue'),
      orders7d: orders,
      spend7d: sum('spend'),
      cpa7d: orders ? sum('spend') / orders : null,
      rating: 4.8,
      reviews: 23,
    },
    // shares of spend / sales, so every range splits the same way
    campaigns: [
      { id: 'c1', name: 'Contour living room', status: 'Active', spendShare: 0.46, salesShare: 0.6 },
      { id: 'c2', name: 'Hiker POV', status: 'Active', spendShare: 0.28, salesShare: 0.12 },
      { id: 'c3', name: 'Ski line to map', status: 'Active', spendShare: 0.2, salesShare: 0.22 },
      { id: 'c4', name: 'Retargeting, studio visitors', status: 'Learning', spendShare: 0.06, salesShare: 0.06 },
    ],
    products: [
      { id: 'p1', name: 'Contour map, framed', share: 0.44, aov: 78 },
      { id: 'p2', name: 'Trail map print', share: 0.27, aov: 54 },
      { id: 'p3', name: 'Ski resort map', share: 0.18, aov: 62 },
      { id: 'p4', name: 'Second map (25% off)', share: 0.11, aov: 46 },
    ],
    recentOrders: [
      { id: '#1047', item: 'Contour map, framed · 18×24', total: 78, at: Date.now() - 2.2 * 3600e3, status: 'Awaiting approval' },
      { id: '#1046', item: 'Trail map print · 12×16', total: 54, at: Date.now() - 9 * 3600e3, status: 'In production' },
      { id: '#1045', item: 'Ski resort map + second map', total: 108, at: Date.now() - 26 * 3600e3, status: 'In production' },
      { id: '#1044', item: 'Contour map, framed · 24×36', total: 96, at: Date.now() - 50 * 3600e3, status: 'Shipped' },
      { id: '#1043', item: 'Trail map print · 18×24', total: 62, at: Date.now() - 74 * 3600e3, status: 'Delivered' },
    ],
  };
}

/* ---------- mock client ---------- */

export class MockLeoClient extends Emitter {
  mode = 'mock';
  state = 'idle';
  tasks = new Map();
  approvals = new Map();
  activity = [];
  metrics = sampleMetrics();
  tools = TOOLS.map((t) => ({ ...t, calls: Math.round(rand(2, 30)), lastUsed: Date.now() - rand(5, 300) * 60e3 }));
  vitals = { gpu: 8, vram: 5.9, vramTotal: 8, temp: 46, tps: 0, ctx: 0.12, uptime: 3 * 86400 + 4 * 3600 + 17 * 60, queue: 0, model: 'qwen3.5-9b · Q4_K_M' };
  brief = null;                       // {text, at, fresh}: the "while you were gone" card
  watch = { items: [], every_minutes: 30 };   // the heartbeat checklist: {items: [{id, n, text}], every_minutes}
  files = null;                       // {items: [{path, name, size, modified, kind}]}: what ORION made (owner)
  style = null;                       // {items: [{id, text}]}: this account's standing rules
  email = null;                       // {email, verified, on}: email alerts for this account (proposed)
  cloud = null;                       // Local / Local+: {mode, on, own, master, configured, allowance_left_usd, budget_remaining_usd, reason}
  admin = null;                       // the owner's master view (ACCOUNTS.md §6), while it's switched on
  #busy = false;
  #adminTimer = null;
  #adminWorld = null;
  #bgTimer = null;
  #vitalsTimer = null;
  #speakAbort = null;

  async connect() {
    this.emit('connection', { status: 'connecting' });
    await sleep(500);
    this.#seed();
    this.emit('connection', { status: 'online', mode: this.mode });
    this.#setState('idle', 'Standing by');
    this.#vitalsTimer = setInterval(() => this.#tickVitals(), 1000);
    this.#scheduleBackground(9000);
  }

  /* ---- public API: what the UI can ask of ORION ---- */

  async send(text, { voice = false, images = null } = {}) {
    const msg = { id: uid('m'), role: 'user', text, at: Date.now(), voice, images: images?.map(({ name, url }) => ({ name, url })) };
    if (voice) this.emit('tool', { call: 'listen', tool: 'voice', phase: 'done', at: Date.now() });
    this.emit('message', msg);
    await this.#respond(text || (images?.length ? 'what is in this picture' : ''), { voice });
  }

  filesList() { setTimeout(() => this.emit('files', this.files), 250); }
  fileGet(path) {
    const f = this.files.items.find((x) => x.path === path);
    const body = `Sample file from the demo: ${f?.name ?? path}\n`;
    setTimeout(() => this.emit('file', { path, name: f?.name ?? path, mime: 'text/plain', data: btoa(body) }), 300);
  }
  styleList() { setTimeout(() => this.emit('style', this.style), 200); }
  emailSet(email) { setTimeout(() => { this.email = { email, verified: false, on: false, sent: true }; this.emit('email_alerts', this.email); }, 700); }
  emailVerify(code) {
    setTimeout(() => {
      if (code === '000000') return this.emit('email_alerts', { ...this.email, error: 'That code isn’t right. Check the latest email from ORION.' });
      this.email = { email: this.email?.email, verified: true, on: true };
      this.emit('email_alerts', this.email);
    }, 600);
  }
  emailOn(on) { setTimeout(() => { this.email = { ...this.email, on }; this.emit('email_alerts', this.email); }, 300); }
  emailRemove() { setTimeout(() => { this.email = { email: null, verified: false, on: false }; this.emit('email_alerts', this.email); }, 300); }
  styleAdd(text) {
    setTimeout(() => { this.style = { items: [...this.style.items, { id: `s${Date.now().toString(36)}`, text }] }; this.emit('style', this.style); }, 400);
  }
  styleRemove(id) {
    setTimeout(() => { this.style = { items: this.style.items.filter((r) => r.id !== id) }; this.emit('style', this.style); }, 300);
  }

  approve(id) { this.#resolveApproval(id, 'approved'); }
  reject(id) { this.#resolveApproval(id, 'rejected'); }

  /** Called by the UI when hands-free mode starts/stops (real client streams mic audio). */
  setListening(on) {
    // Listening: your voice flows in from Whisper to ORION.
    if (on && !this.#busy) {
      this.#setState('listening', 'Listening');
      this.emit('tool', { call: 'listen', tool: 'voice', phase: 'result', label: 'Whisper listening', at: Date.now() });
    }
    if (!on || this.#busy) this.emit('tool', { call: 'listen', tool: 'voice', phase: 'done', at: Date.now() });
    if (!on && this.state === 'listening') this.#setState('idle', 'Standing by');
  }

  /** Local / Local+: this account's own switch. */
  setCloud(on) {
    setTimeout(() => {
      this.cloud = { ...this.cloud, own: on, on, mode: on ? 'local+' : 'local',
        reason: on ? 'Claude can take research, writing and analysis. Quick things stay local.' : 'Only the local model on the PC answers. Nothing leaves the house.' };
      this.emit('cloud', this.cloud);
    }, 350);
  }

  /** The watch list: ORION checks each line on its heartbeat and tells you when one comes true. */
  watchAdd(text) {
    setTimeout(() => {
      const items = this.watch.items;
      if (items.length >= 25) return this.emit('watch', { ...this.watch, result: 'The list is full: 25 is the limit. Remove one first.' });
      const id = `w${Date.now().toString(36)}`;
      this.watch = { ...this.watch, items: [...items, { id, n: items.length + 1, text }], result: 'Added. I’ll check it on my next round.' };
      this.emit('watch', this.watch);
    }, 600);
  }
  watchRemove(id) {
    setTimeout(() => {
      const items = this.watch.items.filter((w) => w.id !== id).map((w, i) => ({ ...w, n: i + 1 }));
      this.watch = { ...this.watch, items, result: 'Removed.' };
      this.emit('watch', this.watch);
    }, 400);
  }
  watchList() { setTimeout(() => this.emit('watch', { ...this.watch, result: undefined }), 200); }

  /** Ask for the brief now. The demo's is fixed, so it just comes back. */
  requestBrief() { setTimeout(() => this.brief && this.emit('brief', { ...this.brief, fresh: false }), 300); }

  /* ---- owner admin view: a pretend household ---- */
  adminOn(on) {
    clearInterval(this.#adminTimer);
    if (!on) { this.admin = null; return; }
    this.#adminWorld ??= sampleAdmin();
    setTimeout(() => {
      this.admin = { ...this.#adminWorld, at: Date.now() };
      this.emit('admin_snapshot', this.admin);
      this.#adminTimer = setInterval(() => this.#adminTick(), 4200);
    }, 350);
  }
  #adminTick() {
    const w = this.#adminWorld;
    const online = w.accounts.filter((a) => a.online);
    const a = online[Math.floor(Math.random() * online.length)];
    if (!a) return;
    const lines = a.role === 'owner'
      ? [['activity', { kind: 'tool', title: 'Checked Ciel orders', detail: '1 new order · $62' }], ['state', { state: 'working', label: 'Shopify', detail: 'orders' }], ['state', { state: 'idle', label: 'Standing by' }]]
      : [['message', { role: 'user', text: 'what’s a good 20 minute dinner?' }], ['state', { state: 'thinking', label: 'Thinking', detail: 'local brain' }], ['activity', { kind: 'search', title: 'Searched “quick weeknight dinners”', detail: '5 sources' }], ['message', { role: 'leo', text: 'Garlic butter shrimp with orzo: 18 minutes, one pan.' }], ['state', { state: 'idle', label: 'Standing by' }]];
    const [type, data] = lines[Math.floor(Math.random() * lines.length)];
    const ev = { user: a.id, name: a.name, role: a.role, type, data: { id: uid('x'), at: Date.now(), ...data }, at: Date.now() };
    if (type === 'state') { a.state = data.state; w.rooms[a.id].state = data.state; }
    if (type === 'activity') w.rooms[a.id].activity.unshift(ev.data);
    this.emit('admin_event', ev);
  }
  #accounts(extra = {}) {
    const d = { accounts: this.#adminWorld.accounts.map((a) => ({ ...a })), ...extra };
    if (this.admin) this.admin.accounts = d.accounts;
    setTimeout(() => this.emit('accounts', d), 300);
  }
  accountAdd({ name, password, budget_usd, address, notes }) {
    const w = (this.#adminWorld ??= sampleAdmin());
    if (!name?.trim()) return this.emit('error', { message: 'A name is needed.' });
    if (password && password.length < 8) return this.emit('error', { message: 'Passwords need 8 characters or more.' });
    if (w.accounts.some((a) => a.name.toLowerCase() === name.trim().toLowerCase())) return this.emit('error', { message: 'That name is taken.' });
    const id = uid('u');
    w.accounts.push({ id, name: name.trim(), role: 'guest', address: address ?? '', notes, budget_usd: budget_usd ?? 0.1, allowance_left_usd: budget_usd ?? 0.1, online: false, state: 'idle', watch_items: 0, facts: 0, pending_approvals: 0, last_seen: null, cloud_mode: 'local' });
    w.rooms[id] = { name: name.trim(), role: 'guest', online: false, state: 'idle', activity: [], approvals: 0, tasks: 0, watch: 0, brief: false };
    this.#accounts({ created: { user: id, token: 'g_' + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14) } });
  }
  accountUpdate({ id, ...patch }) {
    const a = this.#adminWorld?.accounts.find((x) => x.id === id);
    if (!a) return;
    if (patch.password !== undefined) delete patch.password;     // the mock keeps no passwords
    if (patch.cloud !== undefined) { a.cloud_mode = patch.cloud ? 'local+' : 'local'; delete patch.cloud; }
    if (patch.budget_usd !== undefined) a.allowance_left_usd = Math.min(a.allowance_left_usd ?? patch.budget_usd, patch.budget_usd);
    Object.assign(a, patch);
    if (patch.name && this.#adminWorld.rooms[id]) this.#adminWorld.rooms[id].name = patch.name;
    this.#accounts();
  }
  accountRemove(id) {
    const w = this.#adminWorld;
    if (!w) return;
    w.accounts = w.accounts.filter((a) => a.id !== id || a.role === 'owner');
    delete w.rooms[id];
    if (this.admin) delete this.admin.rooms[id];
    this.#accounts({ removed: id });
  }
  accountList() { this.#adminWorld && this.#accounts(); }
  setCloudMaster(on) {
    if (!this.#adminWorld) return;
    this.#adminWorld.cloud_master = !!on;
    if (this.admin) this.admin.cloud_master = !!on;
    if (this.cloud) { this.cloud = { ...this.cloud, master: !!on }; this.emit('cloud', this.cloud); }
  }

  /** Barge-in: user started talking or tapped the orb while ORION speaks. */
  interrupt() {
    this.#speakAbort?.();
  }

  snapshot() {
    return {
      tasks: [...this.tasks.values()],
      approvals: [...this.approvals.values()],
      activity: [...this.activity],
      metrics: this.metrics,
      vitals: this.vitals,
      tools: this.tools.map((t) => ({ ...t })),
      state: this.state,
      brief: this.brief,
      watch: this.watch,
      cloud: this.cloud,
    };
  }

  /* ---- internals ---- */

  #setState(state, label, detail = '') {
    this.state = state;
    this.emit('state', { state, label, detail, at: Date.now() });
  }

  /** Call a tool: request goes out, result comes back. Drives the map's glow and data flow. */
  async #useTool(tool, title, detail = '', ms = 1800, { taskId = null, kind = 'tool' } = {}) {
    const call = uid('c');
    const t = this.tools.find((x) => x.id === tool);
    if (t) { t.calls++; t.lastUsed = Date.now(); }
    this.emit('tool', { call, tool, phase: 'call', label: title, at: Date.now() });
    this.#log(kind, title, detail, { taskId, tool });
    await sleep(ms * 0.5);
    this.emit('tool', { call, tool, phase: 'result', label: title, at: Date.now() });
    await sleep(ms * 0.5);
    this.emit('tool', { call, tool, phase: 'done', label: title, at: Date.now() });
  }

  #log(kind, title, detail = '', { taskId = null, tool = null } = {}) {
    const item = { id: uid('a'), kind, title, detail, taskId, tool, at: Date.now() };
    this.activity.unshift(item);
    this.activity.length = Math.min(this.activity.length, 80);
    this.emit('activity', item);
    return item;
  }

  #upsertTask(t) {
    const prev = this.tasks.get(t.id) ?? {};
    const task = { ...prev, ...t, updatedAt: Date.now() };
    this.tasks.set(task.id, task);
    this.emit('task', task);
    return task;
  }

  #seed() {
    const now = Date.now();
    this.cloud = { mode: 'local+', on: true, own: true, master: true, configured: true, budget_remaining_usd: 4.2, reason: 'Claude can take research, writing and analysis. Quick things stay local.' };
    const d = 864e5;
    this.files = { items: [
      { path: 'reports/ciel-orders-week-46.xlsx', name: 'ciel-orders-week-46.xlsx', size: 18432, modified: now - 3 * 3600e3, kind: 'sheet' },
      { path: 'charts/cpa-by-day.png', name: 'cpa-by-day.png', size: 64210, modified: now - 9 * 3600e3, kind: 'image' },
      { path: 'exports/chat-2026-11-15.txt', name: 'chat-2026-11-15.txt', size: 5120, modified: now - 2 * d, kind: 'text' },
      { path: 'notes/black-friday-plan.md', name: 'black-friday-plan.md', size: 2210, modified: now - 4 * d, kind: 'text' },
    ] };
    this.style = { items: [
      { id: 's1', text: 'Keep replies short, three sentences at most' },
      { id: 's2', text: 'Call me Commander' },
      { id: 's3', text: 'Money in dollars, no cents unless it matters' },
    ] };
    this.watch = { every_minutes: 30, items: [
      { id: 'w1', n: 1, text: 'Tell me if a Ciel order hasn’t shipped within 3 days' },
      { id: 'w2', n: 2, text: 'Let me know if the contour ad costs more than $50 a sale' },
      { id: 'w3', n: 3, text: 'Warn me if it’s going to snow at the cabin this weekend' },
    ] };
    this.brief = {
      text: 'Ciel had 3 orders overnight, $186 in all, and the contour living room ad is still the cheapest per sale at $39. Two new five-star reviews came in. Black Friday CIEL10 is set to go live on the 27th.\n\nOne thing needs you: a draft reply to the Gelato support thread is waiting under the bell.',
      at: now - 2 * 3600e3, fresh: true,
    };
    const seedTasks = [
      { title: 'Morning Ciel briefing', source: 'Ciel ops', status: 'done', progress: 1, createdAt: now - 6 * 3600e3 },
      { title: 'Summarize new reviews', source: 'Ciel ops', status: 'done', progress: 1, createdAt: now - 3 * 3600e3 },
      { title: 'Research: winter print demand', source: 'Research', status: 'queued', progress: 0, createdAt: now - 40 * 60e3 },
      { title: 'Clean up Downloads folder', source: 'ORION machine', status: 'queued', progress: 0, createdAt: now - 25 * 60e3 },
    ];
    seedTasks.forEach((t) => this.#upsertTask({ id: uid('t'), ...t }));
    this.#upsertTask({ id: uid('t'), title: 'Draft the Black Friday email', source: 'Ciel ops', status: 'running', progress: 0.45, createdAt: now - 9 * 60e3, startedAt: now - 6 * 60e3 });
    // routines and timers use the backend's id convention: routine_<name>, timer_<label>
    const tomorrow7 = new Date(); tomorrow7.setDate(tomorrow7.getDate() + 1); tomorrow7.setHours(7, 0, 0, 0);
    this.#upsertTask({ id: 'routine_morning_brief', title: 'Morning Ciel briefing', source: 'Routine', status: 'queued', every: 'day at 07:00', next: +tomorrow7 });
    this.#upsertTask({ id: 'routine_ad_check', title: 'Check ad spend against cost per sale', source: 'Routine', status: 'queued', every: '6 hours', next: now + 2.2 * 3600e3 });
    this.#upsertTask({ id: 'timer_laundry', title: 'Laundry is done', source: 'Timer', status: 'queued', next: now + 18 * 60e3 });
    const on = (y, m, d, h = 9) => +new Date(y, m, d, h);
    const yr = new Date().getFullYear();
    this.#upsertTask({ id: 'plan_ciel10', title: 'Turn on the CIEL10 Black Friday code', source: 'Scheduled', status: 'queued', due: on(yr, 10, 27, 0) });
    this.#upsertTask({ id: 'plan_domain', title: 'Renew the Ciel domain', source: 'Scheduled', status: 'queued', due: on(yr, 11, 14, 10) });
    this.#upsertTask({ id: 'plan_samples', title: 'Order winter print samples', source: 'Scheduled', status: 'queued', due: on(yr + 1, 0, 8, 11) });
    this.#upsertTask({ id: 'routine_reviews', title: 'Read new reviews and flag anything bad', source: 'Routine', status: 'queued', every: 'day at 18:30', next: on(yr, new Date().getMonth(), new Date().getDate(), 18) + 30 * 60e3 });

    const past = [
      ['done', 'Sent morning briefing', '2 orders overnight · CPA $21.40', 6 * 3600e3],
      ['tool', 'Read 3 new reviews', 'All 5★. One mentions fast shipping', 3 * 3600e3],
      ['search', 'Searched “topographic map gifts”', '8 sources · saved 3', 2 * 3600e3],
      ['think', 'Planned research task', 'Broke into 4 steps', 40 * 60e3],
      ['think', 'Heartbeat', 'Order #1043 hasn’t shipped after 3 days', 5 * 3600e3],
    ];
    past.forEach(([kind, title, detail, ago]) => this.activity.push({ id: uid('a'), kind, title, detail, at: now - ago }));

    this.#createApproval({
      title: 'Reply to review from Maya R.',
      source: 'Ciel ops',
      summary: '5★ review: “Gorgeous map of our cabin trail.” Drafted a short thank-you reply.',
      preview: 'Thank you, Maya! So glad the trail map found a home in your cabin. Happy hiking. — Ciel',
      silent: true,
    });
  }

  #createApproval({ title, source, summary, preview, silent = false }) {
    const dupe = [...this.approvals.values()].find((x) => x.title === title); // demo: never re-ask the same thing
    if (dupe) return dupe;
    const a ={ id: uid('ap'), title, source, summary, preview, status: 'pending', at: Date.now() };
    this.approvals.set(a.id, a);
    const task = this.#upsertTask({ id: a.id, title, source, status: 'needs-you', progress: 0.9, createdAt: a.at });
    this.emit('approval', a);
    if (!silent) {
      this.#log('approval', `Needs approval: ${title}`, summary, { taskId: task.id });
      this.emit('notify', { id: uid('n'), title: 'ORION needs your OK', body: title, target: { panel: 'tasks', approvalId: a.id } });
    }
    return a;
  }

  #resolveApproval(id, status) {
    const a = this.approvals.get(id);
    if (!a || a.status !== 'pending') return;
    a.status = status;
    a.resolvedAt = Date.now();
    this.emit('approval', { ...a });
    this.#upsertTask({ id, status: status === 'approved' ? 'done' : 'rejected', progress: 1 });
    this.#log(status === 'approved' ? 'done' : 'rejected', `${status === 'approved' ? 'Approved' : 'Rejected'}: ${a.title}`, status === 'approved' ? 'Carried out' : 'Discarded the draft');
    if (status === 'approved' && !this.#busy) {
      this.#setState('working', 'Carrying it out', a.title);
      setTimeout(() => !this.#busy && this.#setState('idle', 'Standing by'), 1600);
    }
  }

  #tickVitals() {
    const busy = ['thinking', 'working', 'speaking'].includes(this.state);
    const v = this.vitals;
    const ease = (cur, target, k = 0.25) => cur + (target - cur) * k;
    v.gpu = Math.round(ease(v.gpu, busy ? rand(78, 97) : rand(3, 9)));
    v.temp = Math.round(ease(v.temp, busy ? 71 : 46, 0.08));
    v.vram = +ease(v.vram, busy ? rand(6.6, 7.1) : 5.9, 0.3).toFixed(2);
    v.tps = busy && this.state !== 'working' ? +rand(38, 46).toFixed(1) : +ease(v.tps, 0, 0.5).toFixed(1);
    v.uptime += 1;
    v.queue = [...this.tasks.values()].filter((t) => t.status === 'queued').length;
    this.emit('vitals', { ...v, at: Date.now() });
  }

  #scheduleBackground(ms = rand(22000, 38000)) {
    clearTimeout(this.#bgTimer);
    this.#bgTimer = setTimeout(() => this.#backgroundJob(), ms);
  }

  async #backgroundJob() {
    if (this.#busy) return this.#scheduleBackground(8000);
    this.#busy = true;
    const jobs = [
      async () => {
        const t = this.#upsertTask({ id: uid('t'), title: 'Check Shopify orders', source: 'Ciel ops', status: 'running', progress: 0.1, createdAt: Date.now() });
        this.#setState('working', 'Checking Shopify', 'orders since 9:00');
        await this.#useTool('email', 'Read new Shopify order emails', 'orders since 9:00', 2400, { taskId: t.id });
        this.#upsertTask({ id: t.id, progress: 0.6 });
        this.#setState('thinking', 'Reviewing orders');
        await sleep(1600);
        const n = Math.round(rand(0, 2));
        this.metrics.days.at(-1).orders += n;
        this.metrics.updatedAt = Date.now();
        this.emit('metrics', this.metrics);
        if (n) await this.#useTool('email', 'Checked Gelato shipping emails', `${n} order${n > 1 ? 's' : ''} ready to send`, 1800, { taskId: t.id });
        this.#upsertTask({ id: t.id, status: 'done', progress: 1 });
        this.#log('done', n ? `${n} new order${n > 1 ? 's' : ''}` : 'No new orders', n ? 'Gelato fulfillment queued for approval' : 'Checked again in 30 min');
      },
      async () => {
        const t = this.#upsertTask({ id: uid('t'), title: 'Watch ad performance', source: 'Ciel ops', status: 'running', progress: 0.1, createdAt: Date.now() });
        this.#setState('working', 'Pulling Meta Ads', 'last 24 hours');
        await this.#useTool('meta', 'Pulling Meta Ads insights', '3 active ads', 2600, { taskId: t.id });
        this.#upsertTask({ id: t.id, progress: 0.7 });
        this.#setState('thinking', 'Comparing ad sets');
        await this.#useTool('memory', 'Recalled account averages', 'CPA $24 over 30 days', 1500, { taskId: t.id, kind: 'think' });
        this.#upsertTask({ id: t.id, status: 'done', progress: 1 });
        this.#log('think', 'One ad is underperforming', '“Hiker POV” CPA $58 vs $24 average');
        this.#createApproval({
          title: 'Pause “Hiker POV” ad',
          source: 'Ciel ops',
          summary: 'CPA $58 over 3 days, more than double the account average. Pausing frees about $14/day.',
          preview: 'Pause ad 238… in ad set “Outdoor · US · 25–44”. Budget stays on the other two ads.',
        });
      },
      async () => {
        const t = [...this.tasks.values()].find((x) => x.status === 'queued' && x.source === 'Research')
          ?? this.#upsertTask({ id: uid('t'), title: 'Research: gift trends', source: 'Research', status: 'queued', progress: 0, createdAt: Date.now() });
        this.#upsertTask({ id: t.id, status: 'running', progress: 0.05 });
        this.#setState('working', 'Searching the web', t.title.replace('Research: ', ''));
        for (const [i, q] of ['“topographic print” holiday searches', 'Etsy map print best sellers', 'Reddit r/hiking gift threads'].entries()) {
          this.#upsertTask({ id: t.id, progress: 0.2 + i * 0.25 });
          await this.#useTool('web', `Searched ${q}`, `${Math.round(rand(5, 12))} sources`, 1900, { taskId: t.id, kind: 'search' });
        }
        this.#setState('thinking', 'Writing summary');
        await this.#useTool('files', 'Saved research brief', '~/ORION/research/gift-trends.md', 1600, { taskId: t.id });
        this.#upsertTask({ id: t.id, status: 'done', progress: 1 });
        this.#log('done', 'Research brief ready', 'Interest peaks the week after Thanksgiving');
        this.emit('notify', { id: uid('n'), title: 'Research brief ready', body: t.title, target: { panel: 'activity' } });
      },
      async () => {
        const t = [...this.tasks.values()].find((x) => x.status === 'queued' && x.source === 'ORION machine')
          ?? this.#upsertTask({ id: uid('t'), title: 'Tidy project folders', source: 'ORION machine', status: 'queued', progress: 0, createdAt: Date.now() });
        this.#upsertTask({ id: t.id, status: 'running', progress: 0.2 });
        this.#setState('working', 'Scanning files', '~/Downloads');
        await this.#useTool('files', 'Scanned ~/Downloads', '412 files · 6.2 GB', 2800, { taskId: t.id });
        this.#upsertTask({ id: t.id, status: 'done', progress: 1 });
        this.#createApproval({
          title: 'Delete 37 old installers',
          source: 'ORION machine',
          summary: 'Found 37 .dmg/.exe installers older than 90 days (3.1 GB). They’ll go to the Trash, not deleted permanently.',
          preview: 'Move to Trash: ollama-setup.exe, Kokoro-v1.dmg, … (35 more)',
        });
      },
    ];
    try {
      await pick(jobs)();
    } finally {
      this.#busy = false;
      const pending = [...this.approvals.values()].some((a) => a.status === 'pending');
      this.#setState(pending ? 'needs-you' : 'idle', pending ? 'Waiting on you' : 'Standing by');
      if (pending) setTimeout(() => this.state === 'needs-you' && this.#setState('idle', 'Standing by'), 4000);
      this.#scheduleBackground();
    }
  }

  #route(text) {
    const t = text.toLowerCase();
    if (/(ad|ads|ciel|sale|sales|order|cpa|shop|revenue)/.test(t)) return 'ciel';
    if (/(research|search|look up|find out|news|trend)/.test(t)) return 'research';
    if (/(plan|task|todo|to-do|remind|schedule|steps)/.test(t)) return 'plan';
    if (/(gpu|vram|vital|temp|hardware|speed|machine)/.test(t)) return 'vitals';
    return 'chat';
  }

  async #respond(text, { voice }) {
    while (this.#busy) await sleep(200); // let a background job finish its step
    this.#busy = true;
    try {
      const route = this.#route(text);
      // which brain answers: quick things stay local, research and writing go to Claude when Local+ is on
      const big = /research|plan|write|draft|analy|why|compare|launch/i.test(text) || text.length > 90;
      this.emit('route', { tier: this.cloud?.mode === 'local+' && big ? (/plan|launch|analy/i.test(text) ? 'sonnet' : 'haiku') : 'local' });
      this.#setState('thinking', 'Thinking');
      await sleep(rand(700, 1100));

      let reply;
      if (route === 'ciel') {
        this.#setState('working', 'Checking Ciel', 'Shopify + Meta Ads');
        await this.#useTool('clarity', 'Pulled Clarity sessions', 'last 7 days', 1600);
        await this.#useTool('meta', 'Pulled Meta Ads insights', 'last 7 days', 1600);
        const k = this.metrics.kpis;
        reply = `Here's Ciel for the last 7 days (sample data): ${k.orders7d} orders, $${k.revenue7d} in revenue, $${k.spend7d} ad spend, so about $${k.cpa7d?.toFixed(2)} per sale. The contour living-room ad is still carrying most conversions. Want me to look at pausing the weakest ad?`;
      } else if (route === 'research') {
        const task = this.#upsertTask({ id: uid('t'), title: `Research: ${text.slice(0, 40)}`, source: 'Research', status: 'running', progress: 0.1, createdAt: Date.now() });
        this.#setState('working', 'Searching the web');
        for (let i = 0; i < 3; i++) {
          this.#upsertTask({ id: task.id, progress: 0.3 + i * 0.25 });
          await this.#useTool('web', `Web search ${i + 1} of 3`, `${Math.round(rand(4, 10))} sources`, 1400, { taskId: task.id, kind: 'search' });
        }
        await this.#useTool('memory', 'Saved findings to memory', '3 key points', 1200, { kind: 'think' });
        this.#upsertTask({ id: task.id, status: 'done', progress: 1 });
        reply = `I went through about 20 sources. Short version: the strongest signal is gift intent. People search for a "map of where we met" or "our trail", not just "topographic print". I saved the sources to the task, so you can open it from the Tasks board.`;
      } else if (route === 'plan') {
        await this.#useTool('memory', 'Recalled last year’s launch notes', 'Black Friday 2025', 1400, { kind: 'think' });
        await this.#useTool('planner', 'Created 4 tasks', 'Added to your board', 1600);
        const steps = ['Write the brief', 'List what you need', 'Block 2 hours Thursday', 'Review with ORION Friday'];
        steps.forEach((s, i) => this.#upsertTask({ id: uid('t'), title: s, source: 'Planner', status: 'queued', progress: 0, createdAt: Date.now() + i }));
        reply = `I broke that into four steps and put them on your board: write the brief, list what you need, block two hours Thursday, then review with me Friday. I'll nudge you Thursday morning.`;
      } else if (route === 'vitals') {
        const v = this.vitals;
        reply = `I'm healthy. The GPU is at ${v.gpu}% and ${v.temp}°C, using ${v.vram.toFixed(1)} of 8 GB VRAM, and I've been up ${Math.floor(v.uptime / 86400)} days. Most of that memory is me; the voice models run on the CPU.`;
      } else {
        await this.#useTool('memory', 'Checked memory', 'related notes', 1300, { kind: 'think' });
        reply = pick([
          `Got it. Thinking out loud: what's the one outcome you want by the end of this week? Start there, and I'll turn it into tasks and keep track of them while you're out.`,
          `Makes sense. I'd split that into what only you can decide and what I can grind on in the background. Want me to draft the background part as tasks?`,
          `Noted. That's in memory now. Anything you want me to watch for while you're away?`,
        ]);
      }

      this.#setState('speaking', voice ? 'Speaking' : 'Replying');
      await this.#streamReply(reply, { voice });
    } finally {
      this.#busy = false;
      this.#setState('idle', 'Standing by');
    }
  }

  async #streamReply(text, { voice }) {
    const id = uid('m');
    this.emit('message', { id, role: 'leo', text: '', streaming: true, at: Date.now() });
    let aborted = false;
    this.#speakAbort = () => { aborted = true; };
    // Speech for the mock uses the browser's voice as a stand-in for Kokoro.
    const speech = voice ? speak(text, (amp) => this.emit('audio', { amp })) : null;
    const voiceCall = uid('c');
    // Speaking: ORION's words flow out to Kokoro.
    if (voice) this.emit('tool', { call: voiceCall, tool: 'voice', phase: 'call', label: 'Kokoro speaking', at: Date.now() });
    const words = text.split(/(\s+)/);
    let out = '';
    for (const w of words) {
      if (aborted) break;
      out += w;
      this.emit('message', { id, role: 'leo', text: out, streaming: true });
      await sleep(w.trim() ? rand(28, 60) : 0);
    }
    if (speech) { if (aborted) speech.cancel(); else await speech.done; }
    if (voice) this.emit('tool', { call: voiceCall, tool: 'voice', phase: 'done', at: Date.now() });
    this.emit('audio', { amp: 0 });
    this.#speakAbort = null;
    this.emit('message', { id, role: 'leo', text: aborted ? out + ' —' : text, streaming: false, interrupted: aborted });
  }
}

/* ---------- browser TTS stand-in for Kokoro, with a fake amplitude envelope ---------- */

function speak(text, onAmp) {
  const synth = window.speechSynthesis;
  let raf = 0, live = true, wordPulse = 0;
  const loop = () => {
    if (!live) return;
    wordPulse *= 0.9;
    onAmp(Math.min(1, 0.25 + wordPulse + Math.random() * 0.25));
    raf = requestAnimationFrame(loop);
  };
  const stop = () => { live = false; cancelAnimationFrame(raf); onAmp(0); };
  if (!synth) {
    // No speech engine: just animate for the length a voice would take.
    loop();
    const done = sleep(text.length * 55).then(stop);
    return { done, cancel: stop };
  }
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.04; u.pitch = 0.92;
  const voices = synth.getVoices();
  u.voice = voices.find((v) => /Daniel|Aaron|Samantha|Google UK English Male/i.test(v.name)) ?? voices.find((v) => v.lang?.startsWith('en')) ?? null;
  u.onboundary = () => { wordPulse = 0.6; };
  const done = new Promise((res) => { u.onend = u.onerror = () => { stop(); res(); }; });
  synth.cancel();
  synth.speak(u);
  loop();
  return { done, cancel: () => { synth.cancel(); stop(); } };
}

/* ---------- live client: one WebSocket to ORION's server ---------- */

import { DEFAULT_SERVER } from './config.js';

const PROTOCOL = 1;
const STORE = 'orion-server';
const save = (v) => { try { v ? localStorage.setItem(STORE, JSON.stringify(v)) : localStorage.removeItem(STORE); } catch {} };

/**
 * Speaks the wire protocol in ORION-PROTOCOL.md. Keeps the same state, methods
 * and events as MockLeoClient, so the UI can't tell them apart.
 * Every frame is JSON: { "type": "...", "data": { ... } }.
 */
export class RealLeoClient extends Emitter {
  mode = 'live';
  state = 'idle';
  tasks = new Map();
  approvals = new Map();
  activity = [];
  metrics = sampleMetrics();          // stays flagged `sample: true` until the server sends real numbers
  tools = [];
  vitals = { gpu: 0, vram: 0, vramTotal: 8, temp: 0, tps: 0, ctx: 0, uptime: 0, queue: 0, model: 'ORION' };
  account = null;                     // who is logged in: {id, name, role, address, features, …}
  brief = null;                       // {text, at, fresh}: the "while you were gone" card
  watch = { items: [], every_minutes: 30 };   // the heartbeat checklist: {items: [{id, n, text}], every_minutes}
  files = null;                       // {items: [{path, name, size, modified, kind}]}: what ORION made (owner)
  style = null;                       // {items: [{id, text}]}: this account's standing rules
  email = null;                       // {email, verified, on}: email alerts for this account (proposed)
  cloud = null;                       // Local / Local+: {mode, on, own, master, configured, allowance_left_usd, budget_remaining_usd, reason}
  admin = null;                       // the owner's master view (ACCOUNTS.md §6): the last admin_snapshot, kept current
  #adminWanted = false;               // re-asked for after a reconnect
  #url; #creds; #ws = null; #retry = 0; #timer = null; #pending = null;
  #mine = new Set();                  // ids of user messages this tab already showed
  #voiceTurn = false; #speech = null; #serverSpeaks = false;

  /** @param {string} url @param {{token?: string, name?: string, password?: string}} creds */
  constructor(url, creds = {}) { super(); this.#url = url; this.#creds = creds; }

  /** True when there's no saved login: the UI shows the login screen. */
  get needsLogin() { return !this.#creds.token && !this.#creds.name; }

  async connect() {
    if (this.needsLogin) return this.emit('connection', { status: 'offline', mode: this.mode, reason: 'login' });
    this.#open();
  }

  /**
   * Log in with a name and password. Resolves once ORION's snapshot arrives;
   * rejects with {reason: 'auth'} (wrong name or password, or locked out) or
   * {reason: 'network'} (couldn't reach ORION).
   */
  login(name, password) {
    this.#creds = { name, password };
    this.#retry = 0;
    if (this.#ws) { const old = this.#ws; this.#ws = null; try { old.close(); } catch {} }
    return new Promise((resolve, reject) => { this.#pending = { resolve, reject }; this.#open(); });
  }

  #open() {
    clearTimeout(this.#timer);
    this.emit('connection', { status: 'connecting', mode: this.mode });
    let ws;
    try { ws = new WebSocket(this.#url); } catch { if (this.#pending) { this.#settle('network'); return this.emit('connection', { status: 'offline', mode: this.mode }); } return this.#lost(); }
    this.#ws = ws;
    const who = this.#creds.name ? { name: this.#creds.name, password: this.#creds.password ?? '' } : { token: this.#creds.token ?? '' };
    ws.onopen = () => this.#raw({ type: 'hello', data: { ...who, client: 'orion-ui', protocol: PROTOCOL } });
    ws.onmessage = (e) => { try { this.#handle(JSON.parse(e.data)); } catch (err) { console.warn('ORION: bad frame', err); } };
    ws.onclose = (e) => {
      if (this.#ws !== ws) return;
      this.#ws = null;
      if (e.code === 4401) {                       // wrong login (or locked out): don't retry, ask again
        this.#creds = {};
        save({ url: this.#url });
        this.#settle('auth');
        this.emit('connection', { status: 'offline', mode: this.mode, reason: 'auth' });
        return;
      }
      if (this.#pending) { this.#settle('network'); return this.emit('connection', { status: 'offline', mode: this.mode }); }
      this.#lost();
    };
  }

  /** Finish a login() attempt: undefined = success, otherwise why it failed. */
  #settle(reason) {
    const p = this.#pending;
    this.#pending = null;
    if (!p) return;
    reason ? p.reject({ reason }) : p.resolve(this.account);
  }

  #lost() {
    this.emit('connection', { status: 'offline', mode: this.mode });
    const wait = Math.min(30000, 1000 * 2 ** this.#retry++);
    this.#timer = setTimeout(() => this.#open(), wait);
  }

  #raw(frame) {
    if (this.#ws?.readyState !== WebSocket.OPEN) return false;
    this.#ws.send(JSON.stringify(frame));
    return true;
  }

  #cmd(type, data = {}) {
    if (this.#raw({ type, data })) return true;
    this.emit('notify', { id: uid('n'), title: 'ORION is offline', body: 'That didn’t send. Reconnecting…', target: {} });
    return false;
  }

  #handle({ type, data = {} }) {
    switch (type) {
      case 'snapshot': {
        this.#retry = 0;
        if (data.tools) this.tools = data.tools;
        if (data.tasks) this.tasks = new Map(data.tasks.map((t) => [t.id, t]));
        if (data.approvals) this.approvals = new Map(data.approvals.map((a) => [a.id, a]));
        if (data.activity) this.activity = [...data.activity].sort((a, b) => b.at - a.at);
        if (data.metrics) this.metrics = data.metrics;
        if (data.vitals) this.vitals = { ...this.vitals, ...data.vitals };
        this.#serverSpeaks = !!data.speaks;
        if (data.account) this.account = data.account;
        this.brief = data.brief ?? null;
        if (data.watch) this.watch = data.watch;
        this.email = data.email_alerts ?? null;
        this.cloud = data.cloud ?? null;
        if (this.#adminWanted) this.#raw({ type: 'admin', data: { on: true } });
        this.styleList();
        if (this.account?.features?.actions !== false) this.filesList();
        save({ url: this.#url, ...this.#creds });   // the next visit logs in silently
        this.#settle();
        this.emit('connection', { status: 'online', mode: this.mode });
        const st = data.state ?? { state: 'idle', label: 'Standing by' };
        this.state = st.state;
        this.emit('state', st);
        return;
      }
      case 'state': this.state = data.state; return this.emit('state', data);
      case 'message': {
        if (data.role === 'user' && this.#mine.has(data.id)) return;   // already shown when sent
        this.emit('message', data);
        if (data.role === 'leo' && !data.streaming && this.#voiceTurn && !this.#serverSpeaks && !data.interrupted) {
          this.#voiceTurn = false;
          this.#speech = speak(data.text, (amp) => this.emit('audio', { amp }));
        }
        return;
      }
      case 'tool': {
        const t = this.tools.find((x) => x.id === data.tool);
        if (t && data.phase === 'call') { t.calls = (t.calls ?? 0) + 1; t.lastUsed = data.at ?? Date.now(); }
        return this.emit('tool', data);
      }
      case 'tools': this.tools = data.tools ?? []; return this.emit('tools', this.tools);
      case 'task': { const task = { ...(this.tasks.get(data.id) ?? {}), ...data }; this.tasks.set(task.id, task); return this.emit('task', task); }
      case 'approval': { const a = { ...(this.approvals.get(data.id) ?? {}), ...data }; this.approvals.set(a.id, a); return this.emit('approval', a); }
      case 'activity': this.activity.unshift(data); this.activity.length = Math.min(this.activity.length, 200); return this.emit('activity', data);
      case 'metrics': this.metrics = data; return this.emit('metrics', data);
      case 'vitals': this.vitals = { ...this.vitals, ...data }; return this.emit('vitals', this.vitals);
      case 'audio': return this.emit('audio', data);
      case 'notify': return this.emit('notify', { id: data.id ?? uid('n'), target: {}, ...data });
      case 'brief': this.brief = data; return this.emit('brief', data);
      case 'watch': this.watch = data; return this.emit('watch', data);
      case 'files': this.files = data; return this.emit('files', data);
      case 'file': return this.emit('file', data);
      case 'style': this.style = data; return this.emit('style', data);
      case 'email_alerts': this.email = data; return this.emit('email_alerts', data);
      case 'cloud': this.cloud = data; return this.emit('cloud', data);
      case 'route': return this.emit('route', data);
      case 'admin_snapshot': this.admin = data; return this.emit('admin_snapshot', data);
      case 'admin_event': {
        const room = this.admin?.rooms?.[data.user];
        if (room) {
          if (data.type === 'state') room.state = data.data?.state ?? room.state;
          if (data.type === 'activity') { (room.activity ??= []).unshift(data.data); room.activity.length = Math.min(room.activity.length, 50); }
          const a = this.admin.accounts?.find((x) => x.id === data.user);
          if (a && data.type === 'state') a.state = data.data?.state ?? a.state;
        }
        return this.emit('admin_event', data);
      }
      case 'accounts': if (this.admin && data.accounts) this.admin.accounts = data.accounts; return this.emit('accounts', data);
      case 'error': console.warn('ORION:', data.message ?? data); return this.emit('error', data);
      default: return;                              // unknown types are ignored, so the server can add more
    }
  }

  /* ---- public API: same as the mock ---- */

  /** `images`: [{name, mime, data (base64), url (local preview)}]; `task`: {kind, date?} from the Tasks page.
      Both are proposed additions (ORION-PROTOCOL.md "Proposed"); an older backend ignores them. */
  async send(text, { voice = false, images = null, task = null } = {}) {
    const msg = { id: uid('m'), role: 'user', text, at: Date.now(), voice, images: images?.map(({ name, url }) => ({ name, url })) };
    this.#mine.add(msg.id);
    this.#voiceTurn = voice;
    this.emit('message', msg);
    const frame = { id: msg.id, text, voice };
    if (images?.length) frame.images = images.map(({ name, mime, data }) => ({ name, mime, data }));
    if (task) frame.task = task;
    this.#cmd('send', frame);
  }
  /** Files ORION made (owner) and the account's standing rules: proposed frames, see ORION-PROTOCOL.md. */
  filesList() { this.#raw({ type: 'files_list', data: {} }); }
  fileGet(path) { this.#cmd('file_get', { path }); }
  styleList() { this.#raw({ type: 'style_list', data: {} }); }
  styleAdd(text) { this.#cmd('style_add', { text }); }
  styleRemove(id) { this.#cmd('style_remove', { id }); }
  /** Email alerts (proposed): ORION mails a code, the person types it back, then alerts go to that address. */
  emailSet(email) { this.#cmd('email_set', { email }); }
  emailVerify(code) { this.#cmd('email_verify', { code }); }
  emailOn(on) { this.#cmd('email_on', { on: !!on }); }
  emailRemove() { this.#cmd('email_remove', {}); }
  approve(id) { this.#cmd('approve', { id }); }
  reject(id) { this.#cmd('reject', { id }); }
  setListening(on) { this.#raw({ type: 'listening', data: { on } }); }
  /** Ask for the brief now (ORION rate-limits; a cached one comes back with fresh: false). */
  requestBrief() { this.#raw({ type: 'brief', data: {} }); }
  /** The watch list (ACCOUNTS.md §4): every change comes back as a `watch` event. */
  watchAdd(text) { this.#cmd('watch_add', { text }); }
  watchRemove(id) { this.#cmd('watch_remove', { id }); }
  watchList() { this.#raw({ type: 'watch_list', data: {} }); }
  /** Local / Local+ (ACCOUNTS.md §5b): this account's own switch; ORION replies with `cloud`. */
  setCloud(on) { this.#cmd('cloud', { on: !!on }); }
  /** Owner only (ACCOUNTS.md §6): the master view and account management. */
  adminOn(on) { this.#adminWanted = !!on; if (!on) this.admin = null; this.#raw({ type: 'admin', data: { on: !!on } }); }
  accountAdd(d) { this.#cmd('account_add', d); }
  accountUpdate(d) { this.#cmd('account_update', d); }
  accountRemove(id) { this.#cmd('account_remove', { id }); }
  accountList() { this.#raw({ type: 'account_list', data: {} }); }
  setCloudMaster(on) { this.#cmd('cloud_master', { on: !!on }); }
  interrupt() { this.#speech?.cancel(); this.#speech = null; this.#raw({ type: 'interrupt', data: {} }); }

  snapshot() {
    return {
      tasks: [...this.tasks.values()],
      approvals: [...this.approvals.values()],
      activity: [...this.activity],
      metrics: this.metrics,
      vitals: this.vitals,
      tools: this.tools.map((t) => ({ ...t })),
      state: this.state,
      brief: this.brief,
      watch: this.watch,
      cloud: this.cloud,
    };
  }
}

/**
 * Which ORION to talk to. Open the UI once with
 *   ?server=wss://orion-box.your-tailnet.ts.net&token=YOUR_TOKEN
 * and it remembers that server in this browser (the token is then wiped from the
 * address bar). ?demo forgets it and goes back to demo data.
 */
export function createLeoClient() {
  const q = new URLSearchParams(location.search);
  const demo = q.has('demo');
  try {
    if (demo) localStorage.removeItem(STORE);
    // ?server=…&token=… (or just ?token=… for the default server, as guest links do)
    if (q.get('server') || q.get('token')) save({ url: q.get('server') || DEFAULT_SERVER, token: q.get('token') ?? '' });
  } catch {}
  if (q.has('server') || q.has('token') || q.has('demo')) {
    ['server', 'token', 'demo'].forEach((k) => q.delete(k));
    history.replaceState(null, '', location.pathname + (q.size ? `?${q}` : '') + location.hash);
  }
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(STORE) ?? 'null'); } catch {}
  if (demo || (!cfg?.url && !DEFAULT_SERVER)) return new MockLeoClient();
  const url = cfg?.url || DEFAULT_SERVER;
  const creds = cfg?.name ? { name: cfg.name, password: cfg.password } : cfg?.token ? { token: cfg.token } : {};
  return new RealLeoClient(url, creds);
}
