/**
 * The business page: Ciel's numbers in a clean layout.
 * One range control (7 / 14 / 30 days) scopes everything below it, and every
 * figure compares against the period before. Charts are plain SVG, one gold
 * series each; hover, tap, or arrow keys give the exact values, and the two
 * daily charts have a table view.
 */

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => `$${Math.round(v).toLocaleString()}`;
/** A thin numeral with its unit set small: $ before money, % after rates. */
const big = (v, unit = '', pre = false) => `<span class="num">${pre ? `<small>${unit}</small>` : ''}${v}${pre ? '' : `<small>${unit}</small>`}</span>`;
const bigMoney = (v) => big(Math.round(v).toLocaleString(), '$', true);
const sum = (arr, k) => arr.reduce((s, d) => s + d[k], 0);
const dayLabel = (iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, opts);
const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60e3);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};
const RANGES = [7, 14, 30];
/** Label every nth day, always the last, never one crowding the last. */
const tickAt = (i, n, every) => i === n - 1 || (i % every === 0 && n - 1 - i >= every * 0.75);

/** Round an axis max up to a clean step, and give 3 ticks. */
function niceTicks(max) {
  const raw = Math.max(1, max) / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return [0, step, step * 2, step * 3];
}
const tickText = (v, unit) => (unit === '$' ? (v >= 10000 ? `$${Math.round(v / 1000)}K` : `$${v.toLocaleString()}`) : v.toLocaleString());

export function mountBusiness(root, { getMetrics, tooltip }) {
  let range = 14;
  let data = null;

  /* ---------- tooltip ---------- */
  const tip = {
    show(x, y, value, ...lines) {
      tooltip.replaceChildren();
      const b = document.createElement('strong'); b.textContent = value; tooltip.append(b);
      lines.filter(Boolean).forEach((l) => { const s = document.createElement('span'); s.textContent = l; tooltip.append(s); });
      tooltip.style.left = `${Math.max(90, Math.min(innerWidth - 90, x))}px`;
      tooltip.style.top = `${y}px`;
      tooltip.hidden = false;
    },
    hide() { tooltip.hidden = true; },
  };
  root.addEventListener('scroll', () => tip.hide(), { passive: true });

  /* ---------- data for the current range ---------- */
  function slice() {
    const m = getMetrics();
    const cur = m.days.slice(-range), prev = m.days.slice(-2 * range, -range);
    // Visit tracking (Clarity) started later than the order history, so days before its first
    // recorded visit have no visit data at all; they count as missing, not as zero visits.
    const firstVisit = m.days.findIndex((d) => (d.sessions ?? 0) > 0);
    const visitsFrom = firstVisit < 0 ? null : m.days[firstVisit].date;
    const tracked = (d) => visitsFrom != null && d.date >= visitsFrom;
    const agg = (arr) => {
      const orders = sum(arr, 'orders'), revenue = sum(arr, 'revenue'), spend = sum(arr, 'spend');
      const seen = arr.filter(tracked), sessions = sum(seen, 'sessions'), seenOrders = sum(seen, 'orders');
      return { orders, revenue, spend, sessions, cpa: orders && spend ? spend / orders : null, aov: orders ? revenue / orders : null, conv: sessions ? seenOrders / sessions : null };
    };
    return { m, cur, prev, a: agg(cur), b: agg(prev), visitsFrom, tracked };
  }

  /* ---------- page ---------- */
  function render() {
    data = slice();
    const { m, a, b } = data;
    const delta = (x, y, { lowerIsBetter = false, neutral = false } = {}) => {
      if (x == null || y == null || !y) return '<span class="kt-d">no earlier data</span>';
      const p = (x - y) / y;
      const dir = Math.abs(p) < 0.005 ? 'flat' : (p > 0) !== lowerIsBetter ? 'good' : 'bad';
      return `<span class="kt-d"><b class="dchip ${neutral ? 'flat' : dir}">${p > 0 ? '+' : ''}${Math.round(p * 100)}%</b>vs previous ${range} days</span>`;
    };
    const tiles = [
      { k: 'revenue', label: 'Revenue', v: bigMoney(a.revenue), d: delta(a.revenue, b.revenue), hero: true },
      { k: 'orders', label: 'Orders', v: big(a.orders.toLocaleString()), d: delta(a.orders, b.orders) },
      { k: 'spend', label: 'Ad spend', v: bigMoney(a.spend), d: delta(a.spend, b.spend, { neutral: true }) },
      { k: 'cpa', label: 'Cost per sale', v: a.cpa ? bigMoney(a.cpa) : big('—'), d: delta(a.cpa, b.cpa, { lowerIsBetter: true }) },
      { k: 'aov', label: 'Average order', v: a.aov ? bigMoney(a.aov) : big('—'), d: delta(a.aov, b.aov) },
      { k: 'conv', label: 'Conversion', v: a.conv == null ? big('—') : big((a.conv * 100).toFixed(2), '%'), d: a.conv == null ? '<span class="kt-d">no visit data yet</span>' : delta(a.conv, b.conv) },
    ];
    root.innerHTML = `<div class="biz-in">
      <header class="biz-head">
        <div><h1>Ciel</h1><p>${m.sample ? 'Sample data · ' : ''}Updated ${esc(ago(m.updatedAt))} by ORION${m.kpis?.reviews ? ` · ★ ${m.kpis.rating} from ${m.kpis.reviews} review${m.kpis.reviews === 1 ? '' : 's'}` : ''}</p></div>
        <div class="range" role="group" aria-label="Date range"><i></i>${RANGES.map((r) => `<button data-range="${r}" aria-pressed="${r === range}">${r}d</button>`).join('')}</div>
      </header>
      <section class="kts" aria-label="Key numbers">
        ${tiles.map((t) => `<div class="kt ${t.hero ? 'hero' : ''}"><span class="kt-l">${t.label}</span><span class="kt-v">${t.v}</span>${t.d}<svg class="spk" data-spark="${t.k}" aria-hidden="true"></svg></div>`).join('')}
      </section>
      <div class="bgrid">
        <section class="card w8"><div class="card-h"><div><h2>Revenue per day</h2><p>Hover, tap, or use the arrow keys for each day</p></div><span class="big">${bigMoney(a.revenue)}</span></div>
          <div class="chart" data-chart="revenue"></div>${table('revenue')}</section>
        <section class="card w4"><div class="card-h"><div><h2>Store funnel</h2><p>${data.visitsFrom && data.cur.some((d) => !data.tracked(d)) ? `Since ${esc(dayLabel(data.visitsFrom, { month: 'short', day: 'numeric' }))}, when visit tracking started` : 'Share of sessions reaching each step'}</p></div></div>
          <div class="chart" data-chart="funnel"></div></section>
        <section class="card"><div class="card-h"><div><h2>Orders per day</h2><p>${a.orders} orders in ${range} days</p></div></div>
          <div class="chart" data-chart="orders"></div>${table('orders')}</section>
        <section class="card"><div class="card-h"><div><h2>Ad campaigns</h2><p>${m.campaigns?.length ? 'Cost per sale against the account average' : 'Shows up once ORION is connected to Meta Ads'}</p></div>${m.campaigns?.length ? `<span class="big">${bigMoney(a.spend)}</span>` : ''}</div>
          ${m.campaigns?.length ? `<div class="chart" data-chart="campaigns"></div>${campaignTable()}` : ''}</section>
        <section class="card"><div class="card-h"><div><h2>Top products</h2><p>By orders in the last ${range} days</p></div></div>${productTable()}</section>
        <section class="card"><div class="card-h"><div><h2>Latest orders</h2><p>Newest first, across all ranges</p></div></div>${ordersTable()}</section>
      </div>
      ${m.sample ? `<p class="biz-foot">Every number here is sample data until ORION's Shopify and Meta tools are connected.</p>` : ''}
    </div>`;
    const i = RANGES.indexOf(range);
    root.querySelector('.range i').style.transform = `translateX(${i * 100}%)`;
    drawCharts();
  }

  root.addEventListener('click', (e) => {
    const r = e.target.closest('[data-range]');
    if (!r || +r.dataset.range === range) return;
    range = +r.dataset.range;
    root.querySelector('.range i').style.transform = `translateX(${RANGES.indexOf(range) * 100}%)`;
    setTimeout(render, 160);   // let the thumb move first
  });

  /* ---------- tables (also the table view for the daily charts) ---------- */
  function table(kind) {
    const rows = [...data.cur].reverse().map((d) => `<tr><td>${esc(dayLabel(d.date))}</td><td class="r">${kind === 'revenue' ? money(d.revenue) : d.orders}</td><td class="r mute">${kind === 'revenue' ? `${d.orders} orders` : money(d.spend) + ' ads'}</td></tr>`).join('');
    return `<details class="tview"><summary>Show as table</summary><table class="btable"><thead><tr><th>Day</th><th class="r">${kind === 'revenue' ? 'Revenue' : 'Orders'}</th><th class="r">${kind === 'revenue' ? 'Orders' : 'Ad spend'}</th></tr></thead><tbody>${rows}</tbody></table></details>`;
  }
  function campaigns() {
    const { a, m } = data;
    return m.campaigns.map((c) => {
      const spend = a.spend * c.spendShare, sales = Math.round(a.orders * c.salesShare);
      return { ...c, spend, sales, cpa: sales ? spend / sales : null };
    });
  }
  function campaignTable() {
    const rows = campaigns().map((c) => `<tr><td><span class="status ${c.status === 'Active' ? 'ok' : 'warn'}">${esc(c.name)}</span></td><td class="r">${money(c.spend)}</td><td class="r">${c.sales}</td><td class="r">${c.cpa ? money(c.cpa) : '<span class="mute">no sales</span>'}</td></tr>`).join('');
    return `<table class="btable"><thead><tr><th>Campaign</th><th class="r">Spend</th><th class="r">Sales</th><th class="r">Per sale</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function productTable() {
    const { a, m } = data;
    const rows = m.products.map((p) => ({ ...p, orders: Math.round(a.orders * p.share) })).sort((x, y) => y.orders - x.orders);
    const max = Math.max(1, ...rows.map((r) => r.orders));
    return `<table class="btable"><thead><tr><th>Product</th><th class="r">Orders</th><th class="r">Revenue</th></tr></thead><tbody>${rows.map((p) => `<tr><td>${esc(p.name)}<svg class="pbar" viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true"><rect class="trk" width="100" height="3"/><rect class="cu" width="${(p.orders / max) * 100}" height="3"/></svg></td><td class="r">${p.orders}</td><td class="r">${money(p.orders * p.aov)}</td></tr>`).join('')}</tbody></table>`;
  }
  function ordersTable() {
    const cls = { 'Awaiting approval': 'warn', 'In production': 'ok', Shipped: 'ok', Delivered: '' };
    return `<table class="btable"><thead><tr><th>Order</th><th>Item</th><th class="r">Total</th><th class="r">Status</th></tr></thead><tbody>${data.m.recentOrders.map((o) => `<tr><td class="mute">${esc(o.id)}<br><small>${esc(ago(o.at))}</small></td><td>${esc(o.item)}</td><td class="r">${money(o.total)}</td><td class="r"><span class="status ${cls[o.status] ?? ''}">${esc(o.status)}</span></td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- charts ---------- */
  function drawCharts() {
    const { cur } = data;
    root.querySelectorAll('[data-spark]').forEach((svg) => {
      const k = svg.dataset.spark;
      const vals = cur.map((d) => (k === 'cpa' ? (d.orders ? d.spend / d.orders : null) : k === 'aov' ? (d.orders ? d.revenue / d.orders : null) : k === 'conv' ? (data.tracked(d) && d.sessions ? d.orders / d.sessions : null) : d[k]));
      spark(svg, vals);
    });
    root.querySelectorAll('[data-chart]').forEach((el) => {
      const W = Math.max(200, el.clientWidth);
      ({ revenue: lineChart, orders: columns, funnel, campaigns: campaignBars })[el.dataset.chart](el, W);
    });
  }

  /** Under each number: a thin copper bar per day, the latest one lit. */
  function spark(svg, vals) {
    const W = svg.clientWidth || 160, H = 44;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const known = vals.filter((v) => v != null);
    if (known.length < 2) { svg.innerHTML = ''; return; }
    const max = Math.max(...known), min = Math.min(0, ...known);
    const n = vals.length, gap = n > 20 ? 1.5 : 3, bw = Math.max(1, (W - gap * (n - 1)) / n);
    svg.innerHTML = vals.map((v, i) => {
      if (v == null) return '';
      const h = Math.max(2, ((v - min) / (max - min || 1)) * (H - 4));
      return `<rect class="cu ${i === n - 1 ? 'now' : ''}" x="${(i * (bw + gap)).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1"/>`;
    }).join('');
  }

  function lineChart(el, W) {
    const { cur } = data;
    const H = 230, padL = 46, padR = 10, padT = 12, padB = 26;
    const ticks = niceTicks(Math.max(...cur.map((d) => d.revenue)));
    const top = ticks.at(-1);
    const x = (i) => padL + (cur.length > 1 ? (i / (cur.length - 1)) * (W - padL - padR) : 0);
    const y = (v) => padT + (1 - v / top) * (H - padT - padB);
    const pts = cur.map((d, i) => [x(i), y(d.revenue)]);
    const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
    const area = `${line}L${x(cur.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
    const every = Math.ceil(cur.length / Math.max(2, Math.floor((W - padL) / 70)));
    const xt = cur.map((d, i) => (tickAt(i, cur.length, every) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === cur.length - 1 ? 'end' : 'middle'}">${esc(dayLabel(d.date, { month: 'short', day: 'numeric' }))}</text>` : '')).join('');
    const yt = ticks.map((t) => `<line class="${t ? 'grid' : 'base'}" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 8}" y="${y(t) + 3}" text-anchor="end">${tickText(t, '$')}</text>`).join('');
    const last = pts.at(-1);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" tabindex="0" role="img" aria-label="Revenue per day for the last ${cur.length} days">
      <defs><linearGradient id="bizArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e9b57c" stop-opacity="0.22"/><stop offset="1" stop-color="#e9b57c" stop-opacity="0"/></linearGradient></defs>
      ${yt}${xt}<path class="area" d="${area}"/><path class="line" d="${line}"/>
      <circle class="dot" cx="${last[0]}" cy="${last[1]}" r="4"/>
      <g class="xhair" visibility="hidden"><line class="xh" y1="${padT}" y2="${H - padB}"/><circle class="dot" r="5"/></g>
      <rect x="${padL}" y="0" width="${W - padL - padR}" height="${H}" fill="transparent"/></svg>`;
    const svg = el.querySelector('svg'), xh = svg.querySelector('.xhair');
    let idx = cur.length - 1;
    const showAt = (i) => {
      idx = Math.max(0, Math.min(cur.length - 1, i));
      const d = cur[idx], [px, py] = pts[idx];
      xh.setAttribute('visibility', 'visible');
      xh.querySelector('line').setAttribute('x1', px); xh.querySelector('line').setAttribute('x2', px);
      xh.querySelector('circle').setAttribute('cx', px); xh.querySelector('circle').setAttribute('cy', py);
      const r = svg.getBoundingClientRect(), k = r.width / W;
      tip.show(r.left + px * k, r.top + py * k - 6, money(d.revenue), dayLabel(d.date), `${d.orders} order${d.orders === 1 ? '' : 's'} · ${money(d.spend)} ad spend`);
    };
    const off = () => { xh.setAttribute('visibility', 'hidden'); tip.hide(); };
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
      showAt(Math.round(((px - padL) / (W - padL - padR)) * (cur.length - 1)));
    });
    svg.addEventListener('pointerleave', off);
    svg.addEventListener('focus', () => showAt(idx));
    svg.addEventListener('blur', off);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); showAt(idx + (e.key === 'ArrowRight' ? 1 : -1)); }
    });
    void last;
  }

  function columns(el, W) {
    const { cur } = data;
    const H = 190, padL = 30, padT = 12, padB = 24, gap = 2;
    const ticks = niceTicks(Math.max(3, ...cur.map((d) => d.orders)));
    const top = ticks.at(-1);
    const slot = (W - padL) / cur.length;
    const bw = Math.min(24, slot - gap);
    const y = (v) => padT + (1 - v / top) * (H - padT - padB);
    const base = y(0);
    const yt = ticks.map((t) => `<line class="${t ? 'grid' : 'base'}" x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 8}" y="${y(t) + 3}" text-anchor="end">${t}</text>`).join('');
    const every = Math.ceil(cur.length / Math.max(2, Math.floor((W - padL) / 54)));
    const cols = cur.map((d, i) => {
      const cx = padL + slot * i + slot / 2, x0 = cx - bw / 2;
      const h = d.orders ? base - y(d.orders) : 2;
      const r = Math.min(4, bw / 2, h);
      const path = `M${x0},${base}V${base - h + r}Q${x0},${base - h} ${x0 + r},${base - h}H${x0 + bw - r}Q${x0 + bw},${base - h} ${x0 + bw},${base - h + r}V${base}Z`;
      const lab = tickAt(i, cur.length, every) ? `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(dayLabel(d.date, { month: 'short', day: 'numeric' }))}</text>` : '';
      return `<g class="hit" tabindex="0" data-i="${i}"><rect x="${padL + slot * i}" y="0" width="${slot}" height="${base}" fill="transparent"/><path class="col ${d.orders ? '' : 'zero'}" d="${path}"/>${lab}</g>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Orders per day for the last ${cur.length} days">${yt}${cols}</svg>`;
    wireMarks(el, (i, r) => {
      const d = cur[i];
      tip.show(r.left + r.width / 2, r.top + 4, `${d.orders} order${d.orders === 1 ? '' : 's'}`, dayLabel(d.date), `${money(d.revenue)} revenue`);
    }, '.col');
  }

  function funnel(el, W) {
    const cur = data.cur.filter(data.tracked);
    if (!cur.length) { el.innerHTML = '<p class="mute biz-empty">No visit data yet. It fills in from the day visit tracking started.</p>'; return; }
    const steps = [
      ['Sessions', sum(cur, 'sessions')],
      ['Opened the map studio', sum(cur, 'studio')],
      ['Added to cart', sum(cur, 'carts')],
      ['Reached checkout', sum(cur, 'checkouts')],
      ['Ordered', sum(cur, 'orders')],
    ];
    const max = steps[0][1] || 1;
    const rowH = 44, bh = 12, H = steps.length * rowH;
    const rows = steps.map(([name, v], i) => {
      const y0 = i * rowH, w = Math.max(3, (v / max) * W);
      const pct = i ? `${((v / max) * 100).toFixed(v / max < 0.1 ? 1 : 0)}%` : '100%';
      return `<g class="hit" tabindex="0" data-i="${i}"><rect x="0" y="${y0}" width="${W}" height="${rowH}" fill="transparent"/>
        <text class="lab" x="0" y="${y0 + 14}">${esc(name)}</text><text class="val" x="${W}" y="${y0 + 14}" text-anchor="end">${v.toLocaleString()} · ${pct}</text>
        <rect class="track" x="0" y="${y0 + 22}" width="${W}" height="${bh}" rx="4"/><rect class="hb" x="0" y="${y0 + 22}" width="${w}" height="${bh}" rx="4"/></g>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Store funnel">${rows}</svg>`;
    wireMarks(el, (i, r) => {
      const [name, v] = steps[i];
      const prev = i ? steps[i - 1][1] : null;
      tip.show(r.left + Math.min(r.width, (v / max) * r.width) / 2 + 20, r.top + 20, v.toLocaleString(), name, prev ? `${((v / (prev || 1)) * 100).toFixed(1)}% of the step before` : `last ${range} days`);
    });
  }

  function campaignBars(el, W) {
    const list = campaigns();
    const avg = data.a.cpa ?? 0;
    const max = Math.max(avg * 1.2, ...list.map((c) => c.cpa ?? 0)) || 1;
    const rowH = 40, bh = 12, padT = 16, H = padT + list.length * rowH;
    const xv = (v) => (v / max) * (W - 60);
    const rows = list.map((c, i) => {
      const y0 = padT + i * rowH;
      const bar = c.cpa
        ? `<rect class="hb" x="0" y="${y0 + 20}" width="${Math.max(3, xv(c.cpa))}" height="${bh}" rx="4"/><text class="val" x="${xv(c.cpa) + 8}" y="${y0 + 30}">${money(c.cpa)}</text>`
        : `<text class="val" x="0" y="${y0 + 30}">no sales yet · ${money(c.spend)} spent</text>`;
      return `<g class="hit" tabindex="0" data-i="${i}"><rect x="0" y="${y0}" width="${W}" height="${rowH}" fill="transparent"/><text class="lab" x="0" y="${y0 + 13}">${esc(c.name)}</text>${bar}</g>`;
    }).join('');
    const ax = xv(avg);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Cost per sale by campaign">
      ${avg ? `<line class="tgt" x1="${ax}" x2="${ax}" y1="${padT - 4}" y2="${H}"/><text class="tgt-l" x="${ax + 4}" y="${padT - 6}">average ${money(avg)}</text>` : ''}${rows}</svg>`;
    wireMarks(el, (i, r) => {
      const c = list[i];
      tip.show(r.left + r.width * 0.35, r.top + 18, c.cpa ? `${money(c.cpa)} per sale` : 'No sales yet', c.name, `${money(c.spend)} spent · ${c.sales} sale${c.sales === 1 ? '' : 's'}`);
    });
  }

  function wireMarks(el, show, markSel) {
    el.querySelectorAll('g.hit').forEach((g) => {
      const i = +g.dataset.i;
      const go = () => show(i, (markSel ? g.querySelector(markSel) : g).getBoundingClientRect());
      g.addEventListener('pointerenter', go);
      g.addEventListener('pointerdown', go);
      g.addEventListener('focus', go);
      g.addEventListener('pointerleave', () => tip.hide());
      g.addEventListener('blur', () => tip.hide());
    });
  }

  // redraw charts at the new width (layout changes, phone rotation)
  let lastW = 0;
  new ResizeObserver(() => {
    const w = root.clientWidth;
    if (data && w && Math.abs(w - lastW) > 4) { lastW = w; drawCharts(); }
  }).observe(root);

  return { render, refresh: () => { if (data) render(); } };
}
