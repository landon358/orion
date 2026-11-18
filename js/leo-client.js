/*
 * ORION client: the single seam between the UI and ORION's server.
 *
 * Everything the UI knows about ORION arrives as events from this object, and
 * everything the UI asks of ORION goes through its methods. RealLeoClient speaks
 * the wire format in ORION-PROTOCOL.md over one WebSocket. The demo client
 * (?demo) lives in mock-client.js and is only loaded in demo mode.
 */

export class Emitter {
  #h = new Map();
  on(type, fn) { (this.#h.get(type) ?? this.#h.set(type, new Set()).get(type)).add(fn); return () => this.#h.get(type)?.delete(fn); }
  emit(type, data) { this.#h.get(type)?.forEach((fn) => fn(data)); this.#h.get('*')?.forEach((fn) => fn(type, data)); }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (a, b) => a + Math.random() * (b - a);
export const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/* ---------- sample shop numbers: the Business page shows these, marked as samples, until the server sends real ones ---------- */

export function sampleMetrics() {
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


/* ---------- browser TTS stand-in for Kokoro, with a fake amplitude envelope ---------- */

export function speak(text, onAmp) {
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
  opening = null;                     // {text, at, kind}: ORION's first line in the conversation
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
        this.opening = data.opening?.text ? data.opening : null;
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
      case 'opening': if (!data.text) return; this.opening = data; return this.emit('opening', data);
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
export async function createLeoClient() {
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
  if (demo || (!cfg?.url && !DEFAULT_SERVER)) {
    const { MockLeoClient } = await import('./mock-client.js');   // the demo only loads in demo mode
    return new MockLeoClient();
  }
  const url = cfg?.url || DEFAULT_SERVER;
  const creds = cfg?.name ? { name: cfg.name, password: cfg.password } : cfg?.token ? { token: cfg.token } : {};
  return new RealLeoClient(url, creds);
}
