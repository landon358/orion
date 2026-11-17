#!/usr/bin/env node
/**
 * A tiny stand-in for ORION's server: speaks ORION-PROTOCOL.md so the UI can
 * be tested against something real, and shows the ORION side what to build.
 * No dependencies (Node 18+). Not ORION: it fakes the agent with canned replies.
 *
 *   ORION_TOKEN=dev-token node tools/orion-server-example.mjs
 *   then open  http://localhost:8840/?server=ws://localhost:8765&token=dev-token
 *   (or log in with any name and dev-token as the password; a name starting
 *   with "guest" gets a friend's account instead of the owner's)
 *
 * Env: PORT (8765), ORION_TOKEN (dev-token),
 *      ORION_ORIGINS (comma list; default the GitHub Pages site + localhost:8840)
 */

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = +(process.env.PORT ?? 8765);
const TOKEN = process.env.ORION_TOKEN ?? 'dev-token';
const ORIGINS = (process.env.ORION_ORIGINS ?? 'https://landon358.github.io,http://localhost:8840').split(',').map((s) => s.trim());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = (p) => `${p}_${crypto.randomBytes(4).toString('hex')}`;

/* ---------- ORION's state (the real agent owns this) ---------- */

const tools = [
  { id: 'memory', name: 'Memory', desc: 'What ORION remembers', calls: 0, lastUsed: Date.now() },
  { id: 'planner', name: 'Planner', desc: 'Tasks and reminders', calls: 0, lastUsed: Date.now() },
  { id: 'web', name: 'Web', desc: 'Search and read pages', calls: 0, lastUsed: Date.now() },
  { id: 'files', name: 'Files', desc: 'The ORION machine’s files', calls: 0, lastUsed: Date.now() },
  { id: 'voice', name: 'Voice', desc: 'Whisper and Kokoro', calls: 0, lastUsed: Date.now() },
  { id: 'shopify', name: 'Shopify', desc: 'Ciel orders and products', calls: 0, lastUsed: Date.now() },
  { id: 'meta', name: 'Meta Ads', desc: 'Ciel ad results', calls: 0, lastUsed: Date.now() },
  { id: 'gelato', name: 'Gelato', desc: 'Print fulfillment', calls: 0, lastUsed: Date.now() },
];
let state = { state: 'idle', label: 'Standing by', detail: '' };
const tasks = new Map();
const approvals = new Map();
const activity = [];
const vitals = { gpu: 6, vram: 5.9, vramTotal: 8, temp: 45, tps: 0, ctx: 0.1, uptime: 0, queue: 0, model: 'qwen3.5-9b · Q4_K_M' };
const started = Date.now();
const a0 = { id: uid('ap'), title: 'Reply to a 5★ review', source: 'Ciel ops', summary: 'Drafted a short thank-you.', preview: 'Thank you so much! — Ciel', status: 'pending', at: Date.now() };
approvals.set(a0.id, a0);

/* ---------- connections ---------- */

const clients = new Set();
const broadcast = (type, data) => { for (const c of clients) c.send(type, data); };
const setState = (s, label, detail = '') => { state = { state: s, label, detail, at: Date.now() }; broadcast('state', state); };
const log = (kind, title, detail = '', extra = {}) => {
  const a = { id: uid('a'), kind, title, detail, at: Date.now(), ...extra };
  activity.unshift(a); activity.length = Math.min(activity.length, 200);
  broadcast('activity', a);
};
async function useTool(tool, label, ms = 1200) {
  const call = uid('c');
  const t = tools.find((x) => x.id === tool);
  if (t) { t.calls++; t.lastUsed = Date.now(); }
  broadcast('tool', { call, tool, phase: 'call', label, at: Date.now() });
  log('tool', label, '', { tool });
  await sleep(ms / 2);
  broadcast('tool', { call, tool, phase: 'result', label, at: Date.now() });
  await sleep(ms / 2);
  broadcast('tool', { call, tool, phase: 'done', label, at: Date.now() });
}

let interrupted = false;
async function respond(text) {
  interrupted = false;
  setState('thinking', 'Thinking');
  await useTool('memory', 'Checked memory', 900);
  if (/search|research|look up/i.test(text)) { setState('working', 'Searching the web', text.slice(0, 40)); await useTool('web', 'Searched the web', 2000); }
  setState('speaking', 'Replying');
  const reply = `This is the example server. You said: “${text}”. The real ORION answers here, streaming its words as it generates them.`;
  const id = uid('m');
  let out = '';
  for (const w of reply.split(/(\s+)/)) {
    if (interrupted) break;
    out += w;
    broadcast('message', { id, role: 'leo', text: out, streaming: true, at: Date.now() });
    await sleep(w.trim() ? 45 : 0);
  }
  broadcast('message', { id, role: 'leo', text: interrupted ? `${out} —` : reply, streaming: false, interrupted, at: Date.now() });
  setState('idle', 'Standing by');
}

const handlers = {
  async send(c, { id, text, voice }) {
    broadcast('message', { id, role: 'user', text, voice, at: Date.now() });   // other devices see it; the sender ignores its own id
    await respond(text);
  },
  approve(c, { id }) { decide(id, 'approved'); },
  reject(c, { id }) { decide(id, 'rejected'); },
  listening(c, { on }) { if (on && state.state === 'idle') setState('listening', 'Listening'); if (!on && state.state === 'listening') setState('idle', 'Standing by'); },
  interrupt() { interrupted = true; },
  brief(c) { setTimeout(() => c.send('brief', makeBrief(c, false)), 1200); },
};
// The real ORION sends a cached brief in the snapshot, or a `brief` event a few seconds after connect.
function makeBrief(c, fresh = true) {
  const guest = /^guest/i.test(c.name);
  return {
    text: guest
      ? 'Your tea timer finished at 3:10. Nothing on your watch list needed you.\n\nLast time we talked about winter hiking boots; I can pick that up again.'
      : 'Ciel had 2 orders since this morning. The contour ad is still the cheapest per sale.\n\nOne approval is waiting under the bell.',
    at: Date.now() - 40 * 60e3, fresh,
  };
}
function decide(id, status) {
  const a = approvals.get(id);
  if (!a || a.status !== 'pending') return;
  a.status = status; a.resolvedAt = Date.now();
  broadcast('approval', a);
  log(status === 'approved' ? 'done' : 'rejected', `${status === 'approved' ? 'Approved' : 'Rejected'}: ${a.title}`);
}

setInterval(() => {
  const busy = state.state !== 'idle' && state.state !== 'listening';
  vitals.gpu = busy ? 85 + Math.round(Math.random() * 10) : 4 + Math.round(Math.random() * 4);
  vitals.tps = state.state === 'speaking' ? +(38 + Math.random() * 8).toFixed(1) : 0;
  vitals.uptime = Math.round((Date.now() - started) / 1000);
  broadcast('vitals', { ...vitals, at: Date.now() });
}, 1000);

function welcome(c) {
  c.send('snapshot', {
    protocol: 1,
    speaks: false,                       // true once ORION streams Kokoro audio itself
    // names starting with "guest" get a friend's account, so both views can be tried
    account: /^guest/i.test(c.name)
      ? { id: 'g_example', name: c.name, role: 'guest', address: 'Commander', allowance_left_usd: 0.1, features: { actions: false, connectors: false, admin: false, watch: true, brief: true, memory: true } }
      : { id: 'owner', name: c.name, role: 'owner', address: 'sir', features: { actions: true, connectors: true, admin: true, watch: true, brief: true, memory: true } },
    state,
    tools,
    tasks: [...tasks.values()],
    approvals: /^guest/i.test(c.name) ? [] : [...approvals.values()],
    activity,
    vitals,
    // metrics: omitted, so the business page keeps its labelled sample data
  });
}

/* ---------- a minimal WebSocket server (RFC 6455, text frames only) ---------- */

const server = http.createServer((req, res) => { res.writeHead(426, { 'content-type': 'text/plain' }); res.end('ORION speaks WebSocket here.\n'); });

server.on('upgrade', (req, socket) => {
  const origin = req.headers.origin ?? '';
  if (!ORIGINS.includes(origin)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);

  const c = {
    authed: false,
    send(type, data) { if (this.authed) write(socket, 0x1, Buffer.from(JSON.stringify({ type, data }))); },
    close(code, reason = '') { const b = Buffer.alloc(2 + Buffer.byteLength(reason)); b.writeUInt16BE(code); b.write(reason, 2); write(socket, 0x8, b); socket.end(); },
  };
  const helloTimer = setTimeout(() => !c.authed && c.close(4401, 'no hello'), 5000);
  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const f = read(buf);
      if (!f) break;
      buf = buf.subarray(f.size);
      if (f.op === 0x8) { socket.end(); return; }
      if (f.op === 0x9) { write(socket, 0xa, f.payload); continue; }
      if (f.op !== 0x1) continue;
      let msg;
      try { msg = JSON.parse(f.payload.toString('utf8')); } catch { continue; }
      if (!c.authed) {
        // a token, or a name + password (here: any name, with ORION_TOKEN as the password)
        const d = msg.data ?? {};
        const secret = typeof d.password === 'string' && d.name ? d.password : d.token;
        const ok = msg.type === 'hello' && typeof secret === 'string' && safeEqual(secret, TOKEN);
        c.name = d.name || 'Owner';
        if (!ok) { c.close(4401, 'bad token'); return; }
        c.authed = true; clearTimeout(helloTimer); clients.add(c); welcome(c);
        setTimeout(() => c.send('brief', makeBrief(c)), 2500);
        continue;
      }
      Promise.resolve(handlers[msg.type]?.(c, msg.data ?? {})).catch((e) => c.send('error', { message: String(e) }));
    }
  });
  socket.on('close', () => { clients.delete(c); clearTimeout(helloTimer); });
  socket.on('error', () => clients.delete(c));
});

function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function read(b) {
  if (b.length < 2) return null;
  const op = b[0] & 0x0f, masked = b[1] & 0x80;
  let len = b[1] & 0x7f, off = 2;
  if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (b.length < 10) return null; len = Number(b.readBigUInt64BE(2)); off = 10; }
  const mask = masked ? b.subarray(off, off + 4) : null;
  if (masked) off += 4;
  if (b.length < off + len) return null;
  const payload = Buffer.from(b.subarray(off, off + len));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return { op, payload, size: off + len };
}
function write(socket, op, payload) {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
  if (!socket.destroyed) socket.write(Buffer.concat([head, payload]));
}

server.listen(PORT, () => console.log(`Example ORION server on ws://localhost:${PORT} · token ${TOKEN === 'dev-token' ? 'dev-token (set ORION_TOKEN)' : '(from ORION_TOKEN)'} · origins ${ORIGINS.join(', ')}`));
