/**
 * Profile (2026-11-18): the person's own page on ORION. Every account has one.
 *
 * What it shows comes from one `profile` frame (ORION-PROTOCOL.md "Profile"): the title ORION
 * uses for them (editable), email alerts, Local / Local+, and "what ORION knows about you":
 * the facts in their own memory (each removable), their watch items, rules, scheduled tasks and
 * days of notes, plus the owner's note about a guest when there is one. Sign out forgets the
 * saved login on this device only; ORION keeps nothing per device.
 */

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ms = (t) => (t == null || t === '' ? null : typeof t === 'string' ? (isNaN(+t) ? Date.parse(t) : ms(+t)) : t < 1e12 ? t * 1000 : t);
const when = (t) => { t = ms(t); return t ? new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const ago = (t) => {
  t = ms(t);
  if (!t) return 'never';
  const m = Math.round((Date.now() - t) / 60e3);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};
const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const num = (v, unit = '') => `<span class="num">${esc(v)}${unit ? `<small>${esc(unit)}</small>` : ''}</span>`;

export function mountProfile(root, { client, onEmail, onSignOut, onTasks } = {}) {
  let p = null;             // the last profile frame
  let busy = '';            // 'title' | 'forget' while a change is out
  let msg = '';             // the last result sentence
  let bad = false;
  let going = new Set();    // facts being removed
  let showAll = false;
  let armed = false;        // sign out asks twice

  client.on('profile', (d) => {
    p = d;
    busy = '';
    going = new Set();
    if (d.result) { msg = d.result; bad = /^error/i.test(d.result); }
    if (!root.hidden && root.isConnected) render();
  });
  client.on('email_alerts', () => { if (p) { p.email_alerts = client.email ?? p.email_alerts; paint('email'); } });
  client.on('cloud', (c) => { if (p) { p.cloud = c; paint('brain'); } });
  client.on('connection', ({ status }) => { if (status !== 'online') { p = null; armed = false; } });

  const owner = () => p?.role === 'owner';

  function render() {
    if (!p) {
      root.innerHTML = `<div class="biz-in prof-in"><header class="dh"><div><h1>Profile</h1><p>Who you are to ORION, and what he keeps about you.</p></div></header><p class="adm-wait">Asking ORION…</p></div>`;
      client.profileGet?.();
      return;
    }
    const c = p.counts ?? {};
    root.innerHTML = `<div class="biz-in prof-in">
      <header class="dh">
        <div><h1>${esc(p.name)}</h1><p>${owner() ? 'The owner. ORION does everything you ask, on this PC and beyond.' : 'A guest on this ORION. Chat, research, timers, your own memory, watch list and scheduled tasks; nothing that touches the PC or anyone else’s data.'}${p.last_seen ? ` Last here ${esc(ago(p.last_seen))}.` : ''}</p></div>
        <div class="dh-kpis">
          <div class="dk"><span class="dk-l">Facts</span>${num(c.facts ?? 0)}</div>
          <div class="dk"><span class="dk-l">Watching</span>${num(c.watch ?? 0)}</div>
          <div class="dk"><span class="dk-l">Scheduled</span>${num(c.tasks ?? 0)}</div>
          <div class="dk"><span class="dk-l">Rules</span>${num(c.rules ?? 0)}</div>
          <div class="dk"><span class="dk-l">Days of notes</span>${num(c.journal_days ?? 0)}</div>
        </div>
      </header>
      <div class="adm-grid prof-grid">
        <div class="adm-col">
          <section class="dsec" aria-labelledby="pf-t-h"><h2 id="pf-t-h">How ORION addresses you</h2><p class="dd">Your title, once in almost every reply. Leave it empty to go back to “${esc(p.default_address ?? 'Commander')}” (“Commandant” in French).</p><div data-paint="title"></div></section>
          <section class="dsec" aria-labelledby="pf-e-h"><h2 id="pf-e-h">Email alerts</h2><p class="dd">Reminders, finished tasks and watch-list hits, to your own address. A few a week at most.</p><div data-paint="email"></div></section>
          <section class="dsec" aria-labelledby="pf-b-h"><h2 id="pf-b-h">Brain</h2><p class="dd">Which brain answers you right now.</p><div data-paint="brain"></div></section>
          <section class="dsec" aria-labelledby="pf-s-h"><h2 id="pf-s-h">This device</h2><p class="dd">Signing out forgets your login here. Your memory, tasks and rules stay on ORION.</p><div data-paint="signout"></div></section>
        </div>
        <div class="adm-col">
          <section class="dsec" aria-labelledby="pf-k-h"><h2 id="pf-k-h">What ORION knows about you</h2><p class="dd">Facts he saved from your conversations and from “remember…”. Remove any you don’t want kept.</p><div data-paint="facts"></div></section>
          ${p.about ? `<section class="dsec" aria-labelledby="pf-a-h"><h2 id="pf-a-h">${owner() ? 'Your profile note' : 'What the owner told ORION about you'}</h2><p class="dd">Read before every reply to you, never recited back.</p><div class="prof-about">${p.about.split(/\n+/).filter((l) => l.trim()).map((l) => `<p>${esc(l.replace(/^#+\s*/, '').replace(/^[-*]\s+/, ''))}</p>`).join('')}</div></section>` : ''}
        </div>
      </div>
    </div>`;
    ['title', 'email', 'brain', 'signout', 'facts'].forEach(paint);
  }

  const PARTS = {
    title() {
      return `<form class="dform" id="pf-title" autocomplete="off">
          <label><span>ORION calls you</span><input name="address" value="${esc(p.address ?? '')}" maxlength="30" placeholder="${esc(p.default_address ?? 'Commander')}"${busy === 'title' ? ' disabled' : ''}></label>
          <div class="dform-row"><button class="dbtn" type="submit"${busy === 'title' ? ' aria-busy="true"' : ''}>Save</button>
          ${p.address && p.address !== p.default_address ? '<button class="dbtn ghost" type="button" data-reset>Back to default</button>' : ''}</div>
          <p class="derr${bad ? '' : ' ok'}" role="status">${esc(msg)}</p>
        </form>`;
    },
    email() {
      const e = p.email_alerts ?? {};
      const line = e.verified ? (e.on ? `On, to ${esc(e.email)}.` : `Paused. Nothing goes to ${esc(e.email)} until you turn them back on.`)
        : e.email ? `${esc(e.email)}: waiting for your code.` : 'Not set up. ORION can email you when a scheduled task finishes or a reminder is due.';
      return `<p class="prof-line">${line}</p><div class="dform-row"><button class="dbtn${e.verified ? ' ghost' : ''}" type="button" data-email>${e.verified ? 'Manage' : e.email ? 'Enter the code' : 'Set up email alerts'}</button></div>`;
    },
    brain() {
      const c = p.cloud ?? {};
      const mode = c.mode === 'local+' ? 'Local+' : 'Local';
      const left = c.allowance_left_usd != null ? ` Cloud allowance left: $${(+c.allowance_left_usd).toFixed(2)}.` : '';
      return `<p class="prof-line"><b>${mode}</b> · ${esc(c.reason ?? '')}${left}</p><p class="dd">Switch it from the Local / Local+ control by the composer.</p>`;
    },
    signout() {
      return `<div class="dform-row"><button class="dbtn danger${armed ? ' armed' : ''}" type="button" data-signout>${armed ? 'Sign out of this device?' : 'Sign out'}</button></div>`;
    },
    facts() {
      const all = p.facts ?? [];
      if (!all.length) return '<p class="prof-line mute">Nothing saved yet. Tell ORION “remember that…” or just talk; he keeps what matters.</p>';
      const rows = showAll ? all : all.slice(0, 12);
      return `<ul class="prof-facts">${rows.map((f) => `<li${going.has(f.n) ? ' class="going"' : ''}><span>${esc(f.text)}<small>${esc(f.saved ? when(f.saved) : '')}${f.source ? ` · ${esc(f.source)}` : ''}${f.category && f.category !== 'general' ? ` · ${esc(f.category)}` : ''}</small></span><button type="button" class="prof-x" data-forget="${f.n}" data-text="${esc(f.text)}" aria-label="Forget: ${esc(f.text)}"${busy === 'forget' ? ' disabled' : ''}>${X}</button></li>`).join('')}</ul>
        ${all.length > 12 ? `<button type="button" class="dbtn ghost prof-more" data-more>${showAll ? 'Show fewer' : `Show all ${p.facts_total ?? all.length}`}</button>` : ''}
        ${(p.facts_total ?? 0) > all.length ? `<p class="dd">Showing the latest ${all.length} of ${p.facts_total}. Ask ORION “what do you remember about…” for the rest.</p>` : ''}`;
    },
  };

  function paint(part) {
    const el = root.querySelector(`[data-paint="${part}"]`);
    if (!el || !p) return;
    if (part === 'title' && el.contains(document.activeElement) && busy !== 'title') return;   // keep what is being typed
    el.innerHTML = PARTS[part]();
  }

  root.addEventListener('submit', (e) => {
    const f = e.target.closest('#pf-title');
    if (!f) return;
    e.preventDefault();
    const v = f.address.value.trim();
    if (v === (p?.address ?? '') || (!v && p?.address === p?.default_address)) { msg = 'That is already your title.'; bad = false; paint('title'); return; }
    busy = 'title'; msg = ''; bad = false; paint('title');
    client.profileUpdate({ address: v });
  });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) { busy = 'title'; msg = ''; paint('title'); client.profileUpdate({ address: '' }); return; }
    if (e.target.closest('[data-email]')) { onEmail?.(); return; }
    if (e.target.closest('[data-more]')) { showAll = !showAll; paint('facts'); return; }
    const x = e.target.closest('[data-forget]');
    if (x) {
      const n = Number(x.dataset.forget);
      going.add(n); busy = 'forget'; paint('facts');
      client.profileForget(x.dataset.text || n);
      return;
    }
    if (e.target.closest('[data-signout]')) {
      if (!armed) { armed = true; paint('signout'); setTimeout(() => { if (armed) { armed = false; paint('signout'); } }, 4000); return; }
      armed = false;
      onSignOut?.();
      client.signOut?.();
    }
  });

  return {
    open() { render(); if (!p) client.profileGet?.(); },
    close() { armed = false; },
    render,
  };
}
