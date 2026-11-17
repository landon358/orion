/**
 * The owner's admin view (ACCOUNTS.md §6): every account on this ORION, live.
 *
 * Left: the accounts and the add-account form. Middle: the picked account's room,
 * its numbers, a live wall built from `admin_event`, and its settings. Right: the
 * cloud budget, the master Local+ switch and the audit log. Below: a 24-hour dot
 * matrix of every room, then routines, heartbeat and integrations.
 *
 * Only `accounts`, `rooms` and `audit` have documented shapes. budget, routines,
 * heartbeat and integrations are drawn from whatever fields arrive, so a shape
 * change on the PC shows up as plain rows instead of breaking the page.
 */

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Timestamps may come as ms, seconds or ISO strings. */
const ms = (t) => (t == null || t === '' ? null : typeof t === 'string' ? (isNaN(+t) ? Date.parse(t) : ms(+t)) : t < 1e12 ? t * 1000 : t);
const ago = (t) => {
  t = ms(t);
  if (!t) return 'never';
  const m = Math.round((Date.now() - t) / 60e3);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};
const clock = (t) => { t = ms(t); return t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—'; };
const usd = (v, d = 2) => (v == null || isNaN(v) ? '—' : `$${(+v).toFixed(d)}`);
/** A big light number with a small unit: num('4.20', '$') */
const num = (v, unit = '', pre = false) => `<span class="num">${pre && unit ? `<small>${unit}</small>` : ''}${esc(v)}${!pre && unit ? `<small>${unit}</small>` : ''}</span>`;
const words = (k) => String(k).replace(/_/g, ' ').replace(/\b(usd)\b/i, '($)').replace(/^./, (c) => c.toUpperCase());
const STATE = { idle: 'Standing by', thinking: 'Thinking', working: 'Working', speaking: 'Replying', listening: 'Listening', 'needs-you': 'Needs an OK', sleeping: 'Asleep', error: 'Error' };

export function mountAdmin(root, { client, onTokenCopied } = {}) {
  let snap = null;          // the admin snapshot, kept current by events
  let pick = null;          // the selected account id
  let created = null;       // {user, token}: shown once
  let formErr = '';
  let editErr = '';
  let removeArm = 0;        // a first tap on Remove arms it for 3 s
  let busy = false;
  const wall = new Map();   // account id -> [{id, at, kind, text, sub}] newest first
  const WALL_MAX = 80;

  const accounts = () => snap?.accounts ?? [];
  const room = (id) => snap?.rooms?.[id] ?? null;
  const acct = (id) => accounts().find((a) => a.id === id) ?? null;

  /* ---------- data in ---------- */
  client.on('admin_snapshot', (d) => {
    snap = d;
    wall.clear();
    for (const [id, r] of Object.entries(d.rooms ?? {})) {
      wall.set(id, (r.activity ?? []).map((a) => ({ id: a.id, at: ms(a.at ?? a.ts), kind: a.kind ?? 'activity', text: a.title ?? '', sub: a.detail ?? '' })));
    }
    if (!acct(pick)) pick = accounts().find((a) => a.role !== 'owner' && a.online)?.id ?? accounts()[0]?.id ?? null;
    render();
  });
  client.on('admin_event', (e) => {
    if (!snap) return;
    const line = eventLine(e);
    const a = acct(e.user);
    if (a && e.type === 'state') a.state = e.data?.state ?? a.state;
    if (line) {
      const list = wall.get(e.user) ?? [];
      const same = line.id && list.find((x) => x.id === line.id);
      if (same) Object.assign(same, line);
      else { list.unshift(line); list.length = Math.min(list.length, WALL_MAX); }
      wall.set(e.user, list);
      const r = room(e.user);
      if (r && e.type === 'activity') r.activity = [e.data, ...(r.activity ?? [])].slice(0, 50);
    }
    if (!root.isConnected || root.hidden) return;
    paint('accounts');
    if (e.user === pick) { paint('room'); paint('wall'); }
    paint('heat');
  });
  client.on('accounts', (d) => {
    if (!snap) snap = { accounts: [], rooms: {} };
    if (d.accounts) snap.accounts = d.accounts;
    busy = false;
    if (d.created) { created = d.created; formErr = ''; root.querySelector('#adm-add')?.reset(); pick = d.created.user ?? pick; }
    if (d.removed && pick === d.removed) pick = accounts()[0]?.id ?? null;
    editErr = '';
    render();
  });
  client.on('error', (d) => {
    if (!busy) return;
    busy = false;
    const msg = d?.message ?? 'ORION said no.';
    if (root.querySelector('#adm-add [aria-busy="true"]')) formErr = msg; else editErr = msg;
    render();
  });
  client.on('cloud', (c) => { if (snap && c?.master != null) { snap.cloud_master = c.master; paint('budget'); } });

  /** One admin_event as a wall line, or null for frames that only change state. */
  function eventLine({ type, data = {}, name, at }) {
    const t = ms(data.at ?? at) ?? Date.now();
    switch (type) {
      case 'message': {
        if (data.streaming) return { id: data.id, at: t, kind: data.role === 'user' ? 'said' : 'reply', text: (data.text ?? '').slice(0, 240), sub: 'replying…' };
        return { id: data.id, at: t, kind: data.role === 'user' ? 'said' : 'reply', text: (data.text ?? '').slice(0, 240), sub: data.role === 'user' ? name : 'ORION' };
      }
      case 'tool': return null;      // ORION also logs each tool as an activity line; one row is enough
      case 'activity': return { id: data.id, at: t, kind: data.kind ?? 'activity', text: data.title ?? '', sub: data.detail ?? '' };
      case 'task': return { id: `task-${data.id}`, at: t, kind: 'task', text: data.title ?? 'Task', sub: data.status ?? '' };
      case 'approval': return { id: `ok-${data.id}`, at: t, kind: 'approval', text: data.title ?? 'Asked for an OK', sub: data.status ?? '' };
      case 'notify': return { id: data.id, at: t, kind: 'notify', text: data.title ?? '', sub: data.body ?? '' };
      case 'watch': return { at: t, kind: 'watch', text: 'Changed the watch list', sub: `${data.items?.length ?? 0} items` };
      case 'brief': return { at: t, kind: 'brief', text: 'Brief ready', sub: (data.text ?? '').slice(0, 90) };
      default: return null;
    }
  }

  /* ---------- page ---------- */
  function render() {
    if (!snap) {
      root.innerHTML = `<div class="biz-in adm-in"><header class="dh"><div><h1>Admin</h1><p>Every account on this ORION, live.</p></div></header><p class="adm-wait">Opening the master view…</p></div>`;
      return;
    }
    root.innerHTML = `<div class="biz-in adm-in">
      <header class="dh">
        <div><h1>Admin</h1><p>Every account on this ORION, live. Friends should know you can see their activity: tell them when you give them a login.</p></div>
        <div class="dh-kpis" data-paint="kpis"></div>
      </header>
      <div class="adm-grid">
        <div class="adm-col">
          <section class="dsec" aria-labelledby="adm-acc-h"><h2 id="adm-acc-h">Accounts</h2><p class="dd">Pick one to watch their room.</p><div data-paint="accounts"></div></section>
          <section class="dsec" aria-labelledby="adm-add-h"><h2 id="adm-add-h">Add account</h2><p class="dd">A guest gets chat, research, timers and their own watch list, nothing that touches the PC.</p><div data-paint="add"></div></section>
        </div>
        <div class="adm-col mid">
          <section class="dsec room" aria-live="off"><div data-paint="room"></div></section>
          <section class="dsec" aria-labelledby="adm-wall-h"><h2 id="adm-wall-h">Live</h2><p class="dd">Every frame their room gets, as it happens.</p><ol class="wall" data-paint="wall"></ol></section>
          <section class="dsec" data-paint="edit"></section>
        </div>
        <div class="adm-col">
          <section class="dsec" aria-labelledby="adm-b-h"><h2 id="adm-b-h">Cloud budget</h2><p class="dd">Claude spend across every account.</p><div data-paint="budget"></div></section>
          <section class="dsec" aria-labelledby="adm-au-h"><h2 id="adm-au-h">Audit</h2><p class="dd">The last actions ORION's safety layer saw.</p><div data-paint="audit"></div></section>
        </div>
      </div>
      <section class="dsec wide" aria-labelledby="adm-h-h"><h2 id="adm-h-h">Last 24 hours</h2><p class="dd">Activity per room, one dot per hour. Brighter is busier.</p><div data-paint="heat"></div></section>
      <div class="adm-grid three">
        <section class="dsec" aria-labelledby="adm-r-h"><h2 id="adm-r-h">Routines</h2><div data-paint="routines"></div></section>
        <section class="dsec" aria-labelledby="adm-hb-h"><h2 id="adm-hb-h">Heartbeat</h2><div data-paint="heartbeat"></div></section>
        <section class="dsec" aria-labelledby="adm-i-h"><h2 id="adm-i-h">Integrations</h2><div data-paint="integrations"></div></section>
      </div>
    </div>`;
    ['kpis', 'accounts', 'add', 'room', 'wall', 'edit', 'budget', 'audit', 'heat', 'routines', 'heartbeat', 'integrations'].forEach(paint);
  }

  function paint(part) {
    const el = root.querySelector(`[data-paint="${part}"]`);
    if (!el) return;
    const html = PARTS[part]();
    if (part === 'edit' || part === 'add') {
      // keep what's being typed: only repaint forms when nothing in them has focus
      if (el.contains(document.activeElement) && el.dataset.for === String(pick) && part === 'edit') return;
    }
    el.innerHTML = html;
    el.dataset.for = String(pick);
  }

  const PARTS = {
    kpis() {
      const list = accounts();
      const on = list.filter((a) => a.online).length;
      const waiting = list.reduce((s, a) => s + (a.pending_approvals ?? 0), 0);
      const b = snap.budget ?? {};
      const today = b.today_usd ?? b.spent_today_usd ?? null;
      const k = (label, v) => `<div class="dk"><span class="dk-l">${label}</span>${v}</div>`;
      return k('Online', num(`${on}`, ` / ${list.length}`))
        + k('Waiting on you', num(waiting))
        + (today != null ? k('Cloud today', num((+today).toFixed(2), '$', true)) : '')
        + k('Safe mode', `<span class="num word ${snap.safe_mode ? 'warn' : ''}">${snap.safe_mode ? 'On' : 'Off'}</span>`);
    },

    accounts() {
      const list = accounts();
      if (!list.length) return '<p class="mute">No accounts yet.</p>';
      return `<ul class="acc-list">${list.map((a, i) => {
        const left = a.allowance_left_usd;
        return `<li><button class="acc ${a.id === pick ? 'on' : ''}" data-pick="${esc(a.id)}" aria-pressed="${a.id === pick}">
          <span class="nchip">${i + 1}</span>
          <span class="acc-n">${esc(a.name)}<small>${a.role === 'owner' ? 'Owner' : 'Guest'} · ${a.online ? esc(STATE[a.state] ?? a.state ?? 'online') : `seen ${ago(a.last_seen)}`}</small></span>
          <span class="acc-r"><i class="dot ${a.online ? 'on' : ''}" aria-label="${a.online ? 'online' : 'offline'}"></i><span class="tick">${a.role === 'owner' || left == null ? '∞' : usd(left)}</span></span>
        </button></li>`;
      }).join('')}</ul>`;
    },

    add() {
      const shown = created ? acct(created.user) : null;
      return `${created ? `<div class="made" role="status">
          <p><b>${esc(shown?.name ?? 'New account')}</b> is ready. This link logs them in; it's shown once.</p>
          <code class="made-t">${esc(loginLink(created.token))}</code>
          <div class="made-b"><button type="button" class="dbtn" data-copy>Copy link</button><button type="button" class="dbtn ghost" data-dismiss>Done</button></div>
        </div>` : ''}
        <form class="dform" id="adm-add" autocomplete="off">
          <label><span>Name</span><input name="name" required maxlength="40" placeholder="Maya"></label>
          <label><span>Password</span><input name="password" type="password" minlength="8" placeholder="8 or more, optional"></label>
          <label><span>Cloud allowance</span><input name="budget_usd" inputmode="decimal" placeholder="$0.10"></label>
          <label><span>ORION calls them</span><input name="address" maxlength="30" placeholder="their name"></label>
          <button class="dbtn" type="submit" aria-busy="${busy && !editErr ? 'true' : 'false'}">Add account</button>
          <p class="derr" role="alert">${esc(formErr)}</p>
        </form>`;
    },

    room() {
      const a = acct(pick);
      if (!a) return '<p class="mute">Pick an account.</p>';
      const r = room(pick) ?? {};
      const cap = a.budget_usd;
      const stat = (label, v, sub = '') => `<div class="rstat"><span class="dk-l">${label}</span>${v}${sub ? `<span class="rsub">${sub}</span>` : ''}</div>`;
      const left = a.role === 'owner' || a.allowance_left_usd == null ? `<span class="num word">∞</span>` : num((+a.allowance_left_usd).toFixed(2), '$', true);
      return `<div class="room-h">
          <h2 class="room-n">${esc(a.name)}</h2>
          <p class="room-s"><i class="dot ${a.online ? 'on' : ''}"></i>${a.role === 'owner' ? 'Owner' : 'Guest'} · ${a.online ? esc(STATE[a.state] ?? a.state ?? 'Online') : `offline, seen ${ago(a.last_seen)}`}${a.cloud_mode ? ` <span class="tick">${a.cloud_mode === 'local+' ? 'Local+' : 'Local'}</span>` : ''}</p>
        </div>
        <div class="rstats">
          ${stat('Allowance left', left, cap != null && a.role !== 'owner' ? `of ${usd(cap)}` : '')}
          ${stat('Facts', num(a.facts ?? '—'))}
          ${stat('Watching', num(a.watch_items ?? r.watch ?? 0))}
          ${stat('Waiting', num(a.pending_approvals ?? r.approvals ?? 0))}
        </div>`;
    },

    wall() {
      const list = wall.get(pick) ?? [];
      if (!list.length) return '<li class="w-empty">Nothing yet. Lines appear here the moment their room does something.</li>';
      return list.slice(0, 40).map((l) => `<li class="w ${esc(l.kind)}">
          <time class="tick">${clock(l.at)}</time>
          <span class="w-k">${esc(KIND[l.kind] ?? l.kind)}</span>
          <span class="w-t">${esc(l.text)}${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</span>
        </li>`).join('');
    },

    edit() {
      const a = acct(pick);
      if (!a) return '';
      const owner = a.role === 'owner';
      return `<h2>Settings</h2><p class="dd">${owner ? 'Your own account. The name and how ORION addresses you.' : `Change what ${esc(a.name)} gets. Removing logs them out everywhere; their memory folder stays on the PC.`}</p>
        <form class="dform" id="adm-edit" autocomplete="off" data-id="${esc(a.id)}">
          <label><span>Name</span><input name="name" value="${esc(a.name)}" maxlength="40"></label>
          <label><span>ORION calls them</span><input name="address" value="${esc(a.address ?? '')}" maxlength="30" placeholder="their name"></label>
          ${owner ? '' : `<label><span>Cloud allowance</span><input name="budget_usd" inputmode="decimal" value="${a.budget_usd != null ? esc(a.budget_usd) : ''}" placeholder="$0.10"></label>
          <label><span>New password</span><input name="password" type="password" minlength="8" placeholder="leave blank to keep"></label>`}
          <div class="dform-row">
            ${owner ? '' : `<div class="dswitch" role="group" aria-label="Local+ for ${esc(a.name)}">
              <button type="button" data-acloud="0" aria-pressed="${a.cloud_mode !== 'local+'}">Local</button>
              <button type="button" data-acloud="1" aria-pressed="${a.cloud_mode === 'local+'}">Local+</button>
            </div>`}
            <button class="dbtn" type="submit">Save</button>
            ${owner ? '' : `<button class="dbtn danger ${removeArm ? 'armed' : ''}" type="button" data-remove>${removeArm ? `Remove ${esc(a.name)}?` : 'Remove'}</button>`}
          </div>
          <p class="derr" role="alert">${esc(editErr)}</p>
        </form>`;
    },

    budget() {
      const b = snap.budget ?? {};
      const cap = +(b.cap_usd ?? b.monthly_usd ?? b.limit_usd ?? NaN);
      const left = +(b.remaining_usd ?? b.budget_remaining_usd ?? (cap - (b.spent_usd ?? 0)));
      const spent = +(b.spent_usd ?? (cap - left));
      const share = isFinite(cap) && cap > 0 ? Math.min(1, Math.max(0, spent / cap)) : null;
      const by = b.by_account && typeof b.by_account === 'object' ? Object.entries(b.by_account) : [];
      const top = Math.max(0.0001, ...by.map(([, v]) => +v || 0));
      const configured = snap.cloud_configured !== false;
      const master = snap.cloud_master !== false;
      return `${share != null ? gauge(share, left) : `<div class="dgauge-n">${num(isFinite(left) ? left.toFixed(2) : '—', '$', true)}<span class="dk-l">left</span></div>`}
        ${isFinite(cap) ? `<p class="dgauge-s"><span class="tick">${usd(spent)} spent</span><span class="tick">${usd(cap)} cap</span></p>` : ''}
        ${by.length ? `<ul class="dbars">${by.map(([n, v]) => `<li><span>${esc(n)}</span><svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="6" rx="1" class="trk"/><rect width="${Math.max(1, ((+v || 0) / top) * 100)}" height="6" rx="1" class="cu"/></svg><b>${usd(v)}</b></li>`).join('')}</ul>` : ''}
        <div class="master">
          <div><b>Local+ for everyone</b><small>${configured ? (master ? 'Accounts can use Claude within their allowance.' : 'Every answer stays local, for every account.') : 'No Claude key on the PC yet.'}</small></div>
          <div class="dswitch" role="group" aria-label="Local+ for everyone">
            <button type="button" data-master="0" aria-pressed="${!master}">Off</button>
            <button type="button" data-master="1" aria-pressed="${master}" ${configured ? '' : 'disabled'}>On</button>
          </div>
        </div>
        ${rest(b, ['cap_usd', 'monthly_usd', 'limit_usd', 'remaining_usd', 'budget_remaining_usd', 'spent_usd', 'by_account', 'today_usd', 'spent_today_usd'])}`;
    },

    audit() {
      const rows = (snap.audit ?? []).slice(0, 14);
      if (!rows.length) return '<p class="mute">Nothing logged yet.</p>';
      const cls = (o = '') => (/block|reject|deny|fail/i.test(o) ? 'bad' : /approv|ask/i.test(o) ? 'warn' : '');
      return `<table class="dtable"><thead><tr><th>Time</th><th>Who</th><th>Tool</th><th class="r">Outcome</th></tr></thead><tbody>${rows.map((r) => `<tr>
          <td class="mute">${clock(r.ts ?? r.at)}</td><td>${esc(r.user ?? '')}</td>
          <td>${esc(r.tool ?? '')}${r.risk ? `<small class="risk ${esc(r.risk)}">${esc(r.risk)}</small>` : ''}</td>
          <td class="r"><span class="tick ${cls(r.outcome)}">${esc(r.outcome ?? '')}</span></td></tr>`).join('')}</tbody></table>`;
    },

    heat() {
      const list = accounts();
      if (!list.length) return '';
      const H = 24, now = Date.now(), hour = 3600e3;
      const end = Math.ceil(now / hour) * hour;
      const counts = list.map((a) => {
        const c = new Array(H).fill(0);
        for (const l of wall.get(a.id) ?? []) {
          const k = H - 1 - Math.floor((end - (l.at ?? 0)) / hour);
          if (k >= 0 && k < H) c[k]++;
        }
        return c;
      });
      const max = Math.max(1, ...counts.flat());
      const gx = 22, gy = 22, padL = 84, W = padL + gx * H, Hh = gy * list.length + 18;
      const hours = [0, 6, 12, 18, 23].map((i) => `<text x="${padL + gx * i + 3}" y="${Hh - 2}">${new Date(end - (H - i) * hour).toLocaleTimeString([], { hour: 'numeric' })}</text>`).join('');
      return `<div class="heat"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Activity per account over the last 24 hours">
        ${list.map((a, r) => `<text class="hl" x="0" y="${r * gy + 15}">${esc(a.name)}</text>${counts[r].map((n, i) => {
          const v = n / max;
          return `<circle cx="${padL + gx * i + 8}" cy="${r * gy + 11}" r="${n ? 3 + v * 4 : 1.6}" class="${n ? 'hd' : 'h0'}" style="${n ? `opacity:${(0.3 + 0.7 * v).toFixed(2)}` : ''}"><title>${esc(a.name)}: ${n} event${n === 1 ? '' : 's'}</title></circle>`;
        }).join('')}`).join('')}
        ${hours}</svg></div>`;
    },

    routines() { return listish(snap.routines, (r) => [r.name ?? r.id, r.at ?? r.every ?? r.schedule ?? '', r.last_run ?? r.last ?? null, r.ok ?? r.status]); },

    heartbeat() {
      const h = snap.heartbeat;
      if (!h || typeof h !== 'object') return '<p class="mute">No heartbeat data.</p>';
      if (Array.isArray(h)) return listish(h, (r) => [r.name ?? r.user ?? r.id, r.every_minutes ? `every ${r.every_minutes} min` : '', r.last ?? r.last_run ?? null, r.ok ?? r.status]);
      return `<div class="hb">${h.every_minutes ? `<div class="rstat"><span class="dk-l">Every</span>${num(h.every_minutes, ' min')}</div>` : ''}
        ${h.checks_today != null ? `<div class="rstat"><span class="dk-l">Checks today</span>${num(h.checks_today)}</div>` : ''}
        ${h.alerts_today != null ? `<div class="rstat"><span class="dk-l">Alerts today</span>${num(h.alerts_today)}</div>` : ''}</div>
        <p class="dgauge-s">${h.last ? `<span class="tick">last ${ago(h.last)}</span>` : ''}${h.next ? `<span class="tick">next at ${clock(h.next)}</span>` : ''}</p>
        ${rest(h, ['every_minutes', 'checks_today', 'alerts_today', 'last', 'next'])}`;
    },

    integrations() {
      const g = snap.integrations;
      if (!g || typeof g !== 'object') return '<p class="mute">No integrations reported.</p>';
      const rows = Array.isArray(g) ? g.map((x) => [x.name ?? x.id, x.status ?? (x.ok ? 'connected' : 'off')]) : Object.entries(g).map(([k, v]) => [k, typeof v === 'object' && v ? v.status ?? (v.ok ? 'connected' : 'off') : v === true ? 'connected' : v === false ? 'off' : v]);
      return `<table class="dtable"><tbody>${rows.map(([n, s]) => `<tr><td>${esc(words(n))}</td><td class="r"><span class="tick ${/connect|ok|on|ready/i.test(s) ? 'good' : /off|error|fail/i.test(s) ? 'bad' : ''}">${esc(s ?? '—')}</span></td></tr>`).join('')}</tbody></table>`;
    },
  };

  const KIND = { said: 'Said', reply: 'ORION', tool: 'Tool', search: 'Search', think: 'Think', done: 'Done', approval: 'OK?', rejected: 'Blocked', task: 'Task', notify: 'Notice', watch: 'Watch', brief: 'Brief', activity: 'Activity' };

  /** Semicircle gauge: share of the cap spent, money left in the middle. */
  function gauge(share, left) {
    const R = 74, cx = 90, cy = 86, a0 = Math.PI, a1 = Math.PI * (1 - share);
    const pt = (a) => `${(cx + R * Math.cos(a)).toFixed(2)},${(cy - R * Math.sin(a)).toFixed(2)}`;
    const ticks = Array.from({ length: 21 }, (_, i) => {
      const a = Math.PI * (1 - i / 20), r1 = R + 9, r2 = R + (i % 5 ? 12 : 15);
      return `<line x1="${cx + r1 * Math.cos(a)}" y1="${cy - r1 * Math.sin(a)}" x2="${cx + r2 * Math.cos(a)}" y2="${cy - r2 * Math.sin(a)}"/>`;
    }).join('');
    return `<div class="dgauge"><svg viewBox="0 0 180 96" aria-hidden="true">
        <g class="g-ticks">${ticks}</g>
        <path class="g-trk" d="M${pt(a0)} A${R} ${R} 0 0 1 ${pt(0)}"/>
        ${share > 0.002 ? `<path class="dg-arc" d="M${pt(a0)} A${R} ${R} 0 0 1 ${pt(a1)}"/>` : ''}
      </svg><div class="dgauge-n">${num(isFinite(left) ? left.toFixed(2) : '—', '$', true)}<span class="dk-l">left this month</span></div></div>`;
  }

  /** Any leftover fields as plain hairline rows, so new data is visible without a UI change. */
  function rest(obj, skip) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
    const rows = Object.entries(obj).filter(([k, v]) => !skip.includes(k) && v != null && typeof v !== 'object');
    if (!rows.length) return '';
    return `<table class="dtable kv"><tbody>${rows.map(([k, v]) => `<tr><td class="mute">${esc(words(k))}</td><td class="r">${esc(/(_at|_ts|^last|^next)/.test(k) ? ago(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v)}</td></tr>`).join('')}</tbody></table>`;
  }

  /** Arrays or objects of things with a name, a schedule, a last run and an ok flag. */
  function listish(x, pickRow) {
    if (!x) return '<p class="mute">Nothing reported.</p>';
    const items = Array.isArray(x) ? x : Object.entries(x).map(([k, v]) => (v && typeof v === 'object' ? { name: k, ...v } : { name: k, status: v }));
    if (!items.length) return '<p class="mute">None set up.</p>';
    return `<table class="dtable"><tbody>${items.map((it) => {
      const [n, when, last, ok] = pickRow(it);
      const bad = ok === false || /fail|error/i.test(String(ok ?? ''));
      return `<tr><td>${esc(words(n ?? '—'))}${when ? `<small>${esc(when)}</small>` : ''}</td><td class="r"><span class="tick ${bad ? 'bad' : ''}">${last ? ago(last) : typeof ok === 'string' ? esc(ok) : '—'}</span></td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function loginLink(token) {
    const u = new URL(location.href);
    u.hash = '';
    u.search = `?token=${encodeURIComponent(token)}`;
    return u.toString();
  }

  /* ---------- input ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.pick) {
      pick = t.dataset.pick; removeArm = 0; editErr = '';
      ['accounts', 'room', 'wall', 'edit'].forEach(paint);
      return;
    }
    if (t.dataset.master != null) return client.setCloudMaster(t.dataset.master === '1'), (snap.cloud_master = t.dataset.master === '1'), paint('budget');
    if (t.dataset.acloud != null) {
      const a = acct(pick);
      if (!a) return;
      busy = true;
      a.cloud_mode = t.dataset.acloud === '1' ? 'local+' : 'local';
      client.accountUpdate({ id: a.id, cloud: t.dataset.acloud === '1' });
      return paint('room'), paint('edit');
    }
    if (t.hasAttribute('data-remove')) {
      if (!removeArm) {
        removeArm = setTimeout(() => { removeArm = 0; paint('edit'); }, 3000);
        return paint('edit');
      }
      clearTimeout(removeArm); removeArm = 0; busy = true;
      return client.accountRemove(pick);
    }
    if (t.hasAttribute('data-copy') && created) {
      navigator.clipboard?.writeText(loginLink(created.token)).then(() => { t.textContent = 'Copied'; onTokenCopied?.(); }, () => { t.textContent = 'Select and copy'; });
      return;
    }
    if (t.hasAttribute('data-dismiss')) { created = null; paint('add'); }
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const v = Object.fromEntries(new FormData(f));
    const money = (s) => { const n = parseFloat(String(s ?? '').replace(/[$\s]/g, '')); return isFinite(n) ? n : undefined; };
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined && x !== ''));
    if (f.id === 'adm-add') {
      if (!v.name.trim()) return;
      if (v.password && v.password.length < 8) { formErr = 'Passwords need 8 characters or more.'; return paint('add'); }
      formErr = ''; busy = true; created = null;
      f.querySelector('button[type=submit]').setAttribute('aria-busy', 'true');
      client.accountAdd(clean({ name: v.name.trim(), password: v.password, budget_usd: money(v.budget_usd), address: v.address?.trim() }));
    }
    if (f.id === 'adm-edit') {
      const a = acct(f.dataset.id);
      if (!a) return;
      if (v.password && v.password.length < 8) { editErr = 'Passwords need 8 characters or more.'; return paint('edit'); }
      const patch = { id: a.id };
      if (v.name?.trim() && v.name.trim() !== a.name) patch.name = v.name.trim();
      if ((v.address ?? '').trim() !== (a.address ?? '')) patch.address = v.address.trim();
      const b = money(v.budget_usd);
      if (b !== undefined && b !== a.budget_usd) patch.budget_usd = b;
      if (v.password) patch.password = v.password;
      if (Object.keys(patch).length === 1) return;
      editErr = ''; busy = true;
      client.accountUpdate(patch);
      document.activeElement?.blur();
    }
  });

  return {
    /** Entering the page switches the master view on; leaving switches it off. */
    open() { if (!snap) render(); client.adminOn?.(true); },
    close() { client.adminOn?.(false); },
    render,
  };
}
