# Connecting ORION to the ORION UI

## Start here: the brief from Landon

> I have a finished web UI for ORION at https://landon358.github.io/orion/ (code: https://github.com/landon358/orion). Your job is ORION's side: one WebSocket server on this machine that speaks the protocol in this file. Read all of it first; it has every message, the security rules and a checklist for when it's done. `tools/orion-server-example.mjs` in the repo is a working, dependency-free reference server to copy from.
>
> Key points:
> - It must be reachable as `wss://`. Use `tailscale serve --bg 8765` with MagicDNS and HTTPS certificates turned on, so the UI connects to `wss://<this-machine>.<tailnet>.ts.net`.
> - Only accept connections from `https://landon358.github.io` (and `http://localhost:8840` for testing).
> - Generate a long random token. The UI's first message is `hello` with that token. If the token is wrong, or no `hello` arrives within 5 seconds, close with code 4401.
> - After a good `hello`, send a `snapshot`. Then send `state`, `message` (stream the full text so far under one id), `tool` (call → result → done), `activity`, `task`, `approval`, `vitals` about once a second, and `metrics` for the Ciel page.
> - Handle these from the UI: `send`, `approve`, `reject`, `listening`, `interrupt`.
> - Voice, phase 1: the browser does speech-to-text and speaks replies. Leave `speaks: false` for now.
>
> When it passes the checklist in section 7, give me the link `https://landon358.github.io/orion/?server=wss://<host>&token=<TOKEN>` so I can open it once on each device.

---

This is the brief for whoever builds ORION's server (the agent on the RTX 2070 machine). The web UI is finished and already speaks this protocol. Your job is to expose **one WebSocket endpoint** that sends the events below and accepts the commands below. Nothing in the UI needs to change.

- **UI, live:** https://landon358.github.io/orion/
- **UI code:** https://github.com/landon358/orion. The client is `RealLeoClient` in `js/leo-client.js`.
- **Working reference server:** `tools/orion-server-example.mjs`. It has no dependencies and fakes the agent with canned replies; read it alongside this doc.

## 1. Transport and security

- **One WebSocket.** Every frame is UTF-8 JSON shaped `{"type": "...", "data": {...}}`. Unknown `type`s are ignored on both sides, so either side can add more later.
- **It must be `wss://`.** The UI is served over HTTPS, so browsers block a plain `ws://` connection to anything but localhost.
- **Recommended route: Tailscale.** Nothing gets exposed to the internet, and Tailscale provides the HTTPS:
  1. In the tailnet admin, turn on MagicDNS and HTTPS certificates.
  2. Run the server on `localhost:8765` on the ORION machine.
  3. Run `tailscale serve --bg 8765`. The UI then connects to `wss://<machine-name>.<tailnet>.ts.net`. Tailscale terminates TLS and passes WebSocket upgrades through.
  4. The user's phone and laptop must be signed in to the same tailnet.
- **Check the Origin header.** Accept only `https://landon358.github.io` and `http://localhost:8840` (local development). Answer anything else with `403`.
- **Authenticate with a token.**
  - Generate a long random secret on the ORION machine, at least 32 bytes, e.g. `openssl rand -hex 32`. Keep it in an env var or config file, never in a repo.
  - The client's **first frame** is `hello` with the token. Compare it in constant time.
  - On a wrong or missing token, or no `hello` within 5 seconds, close with code **4401**. The UI then stops retrying and shows "ORION refused the connection".
- **Reconnects.** The UI reconnects with backoff from 1 s up to 30 s. Every new connection does `hello` and gets a fresh `snapshot`, so the server needs no per-client resume logic.
- **Several devices at once.** Send every event to every authenticated connection.

### How the user connects a device (once per browser)

```
https://landon358.github.io/orion/?server=wss://<machine>.<tailnet>.ts.net&token=<TOKEN>
```

The UI saves both values in that browser and wipes them from the address bar. `?demo` forgets them and returns to demo data.

## 2. Handshake

**Client → server, first frame:**

```json
{"type": "hello", "data": {"token": "…", "client": "orion-ui", "protocol": 1}}
```

**Server → client, straight after a good hello:** a `snapshot` with everything the UI needs to draw.

```json
{"type": "snapshot", "data": {
  "protocol": 1,
  "speaks": false,
  "state": {"state": "idle", "label": "Standing by", "detail": ""},
  "tools": [ToolInfo, …],
  "tasks": [Task, …],
  "approvals": [Approval, …],
  "activity": [Activity, …],
  "vitals": Vitals,
  "metrics": Metrics
}}
```

- **`speaks`:** `true` if ORION plays its own voice (Kokoro). While it's `false`, the UI reads voice replies aloud with the browser's voice. See section 6.
- **`metrics` is optional.** Without it, the Business page shows its sample data with a note saying so.

## 3. Commands (client → server)

| `type` | `data` | What ORION should do |
|---|---|---|
| `send` | `{id, text, voice}` | A message from the user. `id` is made by the client. Broadcast it back as a `message` with `role: "user"` **and the same `id`**: other devices show it, and the sending tab ignores its own. `voice: true` means the text came from the mic (browser speech recognition). Then do the work and reply. |
| `approve` | `{id}` | Carry out the pending approval. Then send `approval` with `status: "approved"`, plus `task` and `activity` updates. |
| `reject` | `{id}` | Discard it. Send `approval` with `status: "rejected"`. |
| `listening` | `{on}` | Hands-free mode started or stopped. Usually just set `state` to `listening` / `idle`. |
| `interrupt` | `{}` | The user barged in. Stop generating or speaking now, and finish the current reply with `interrupted: true`. |

## 4. Events (server → client)

Times are Unix milliseconds (`at`). Send any event whenever it happens; the UI merges updates by `id`.

### `state`: what ORION is doing right now

`{state, label, detail?, at}`

- **`state`** is one of `idle | listening | thinking | working | speaking | needs-you | sleeping | error`.
  - `thinking` and `working` make the gold disc breathe.
  - `needs-you` puts a coral ring around it.
- **`label`** is the short status text, e.g. "Searching the web".
- **`detail`** is optional extra text, e.g. "orders since 9:00".
- **A normal turn:** `thinking` → (`working` while tools run) → `speaking` while the reply streams → `idle`.

### `message`: chat

`{id, role: "user"|"leo", text, streaming, interrupted?, at}`

- **Stream a reply** by sending the **same `id`** again and again with the **full text so far** (not deltas) and `streaming: true`.
- **Finish** with one last frame with `streaming: false`.
- **Animation:** each frame where the text grew makes the bands ripple, so stream at word or token granularity.

### `tool`: a tool call

`{call, tool, phase: "call"|"result"|"done", label, at}`

- **`call`** is a unique id for this one invocation.
- **`tool`** is a tool `id` from `tools`.
- **Phases:** send `call` when the request goes out, `result` when data comes back, and `done` when it finishes (always send `done`, even on errors).
- **On screen:** a tool's band glows gold from `call` until `done`. Several tools can be live at once.

### `activity`: the log

`{id, kind, title, detail?, taskId?, tool?, at}`

- **`kind`** is one of `tool | search | think | done | approval | rejected`.
- **Inside a reply:** `tool`, `search` and `think` entries sent between a user's `send` and the reply's first `message` frame become the reply's collapsible "N steps" list, and the live "working…" line.
- **The home page note:** the latest `tool`/`search`/`done`/`think` items fill the "while you were gone" list.

### `task`

`{id, title, source, status: "queued"|"running"|"needs-you"|"done"|"rejected", progress: 0–1, createdAt}`

- **`source`** is a short group name, e.g. "Ciel ops", "Research", "Planner" or "ORION machine".
- **Partial updates** are fine: `{id, progress: 0.6}`.

### `approval`: drafts waiting for the user's OK

`{id, title, source, summary, preview, status: "pending"|"approved"|"rejected", at}`

- **`summary`** is one line on what and why.
- **`preview`** is the exact draft (the reply text, the ad change, and so on).
- **Pairing:** also send a `task` with the same `id` and `status: "needs-you"`.
- **On screen:** pending approvals appear under the bell. The UI gives the user 5 seconds to undo before it sends `approve` or `reject`.

### `notify`: an in-app banner

`{title, body, target?: {panel?: "activity"|"tasks"|"vitals"}}`

Use it for things worth interrupting for, like a new approval. Phone push notifications are not wired up yet.

### `vitals`: the ORION machine, about once a second

`{gpu, vram, vramTotal, temp, tps, ctx, uptime, queue, model}`

- **Units:** GPU % · VRAM GB · °C · tokens per second · context used 0–1 · uptime in seconds · queued tasks.
- **`model`:** the model string, e.g. `"qwen3.5-9b · Q4_K_M"`.
- **Partial updates** are fine.

### `audio`: voice loudness

`{amp: 0–1}`

- **When:** while ORION speaks, about 20–30 times a second.
- **On screen:** it makes the bands ripple with his voice.
- **Ending:** send `{amp: 0}` at the end.

### `metrics`: numbers for the Ciel Business page

Send the whole object whenever it changes. Every field shown is used:

```json
{
  "updatedAt": 1763251200000,
  "days": [{"date": "2026-11-15", "orders": 2, "revenue": 132, "spend": 41, "sessions": 210, "studio": 64, "carts": 9, "checkouts": 5}],
  "kpis": {"rating": 4.8, "reviews": 23},
  "campaigns": [{"id": "c1", "name": "Contour living room", "status": "Active", "spendShare": 0.46, "salesShare": 0.6}],
  "products": [{"id": "p1", "name": "Contour map, framed", "share": 0.44, "aov": 78}],
  "recentOrders": [{"id": "#1047", "item": "Contour map, framed · 18×24", "total": 78, "at": 1763243280000, "status": "In production"}]
}
```

- **`days`:** at least 60 days, oldest first, so the 7, 14 and 30-day views have a previous period to compare against.
  - `revenue` and `spend` are in USD.
  - `studio`, `carts` and `checkouts` are funnel counts: opened the map studio, added to cart, reached checkout.
- **Sources:** Shopify for orders and revenue, Meta Ads for spend, the site's analytics for sessions and the funnel.
- **`spendShare` / `salesShare`:** each campaign's fraction of total spend and of sales.
- **No `sample` field:** never send one. The UI shows the "sample data" note only when it is set.

### `tools`: replace the tool list

`{tools: [ToolInfo, …]}`. This is rarely needed, since the list normally arrives in `snapshot`.

**ToolInfo:** `{id, name, desc, calls, lastUsed}`

- **On screen:** each tool is a row in the Vitals panel, in list order, with its own detail page. Any number of tools works; ids the UI doesn't know get a generic icon.
- **Ids:** these have icons, so use them where they fit: `memory, planner, web, files, voice, shopify, meta, gelato`. Other ids work, with a generic icon.

### `error`

`{message}`. Logged to the browser console. Use it for problems with a command.

## 5. A complete turn, frame by frame

```
→ {"type":"send","data":{"id":"m_k2j","text":"How are the ads doing?","voice":false}}
← {"type":"message","data":{"id":"m_k2j","role":"user","text":"How are the ads doing?","at":…}}
← {"type":"state","data":{"state":"thinking","label":"Thinking"}}
← {"type":"state","data":{"state":"working","label":"Pulling Meta Ads","detail":"last 7 days"}}
← {"type":"tool","data":{"call":"c_1","tool":"meta","phase":"call","label":"Pulling Meta Ads insights"}}
← {"type":"activity","data":{"id":"a_1","kind":"tool","title":"Pulled Meta Ads insights","detail":"3 active ads","tool":"meta","at":…}}
← {"type":"tool","data":{"call":"c_1","tool":"meta","phase":"result"}}
← {"type":"tool","data":{"call":"c_1","tool":"meta","phase":"done"}}
← {"type":"state","data":{"state":"speaking","label":"Replying"}}
← {"type":"message","data":{"id":"m_r9","role":"leo","text":"Spend","streaming":true}}
← {"type":"message","data":{"id":"m_r9","role":"leo","text":"Spend is $212","streaming":true}}
   … the full text so far, each time …
← {"type":"message","data":{"id":"m_r9","role":"leo","text":"Spend is $212 this week…","streaming":false}}
← {"type":"state","data":{"state":"idle","label":"Standing by"}}
```

## 6. Voice

**Now: phase 1, works today, nothing extra to build.**

- **Listening:** the UI does speech-to-text in the browser and sends the transcript as `send` with `voice: true`.
- **Speaking:** while `snapshot.speaks` is `false`, the UI reads the final reply aloud with the browser's voice.
- **Barge-in:** `interrupt` arrives when the user starts talking over ORION.

**Later: phase 2, ORION's own voice. Agree on it before building.**

- **The plan:** stream the mic to ORION's Whisper, and have ORION play Kokoro.
- **What's settled:** set `speaks: true` in the snapshot, and send `audio {amp}` while Kokoro talks.
- **Not settled yet:** whether audio goes as binary WebSocket frames or as a separate stream. Raise it with the user when you get there; the UI side will be added then.

## 7. Test it

**Against the reference server, locally:**

1. Start the UI: in the UI repo run `npx serve -l 8840 .` (or any static server on port 8840).
2. Start the reference server: `ORION_TOKEN=dev-token node tools/orion-server-example.mjs`
3. Open `http://localhost:8840/?server=ws://localhost:8765&token=dev-token`
4. You should see a green connection, 8 bands, and an approval under the bell. Sending a message gets a streamed reply, with the Memory band (and Web, for "research …") glowing during the turn.

**Your server, done when all of these work:**

- [ ] `hello` with the right token gets a `snapshot`. A wrong token gets close code 4401.
- [ ] Origin is checked, and the server is reachable at `wss://…ts.net` from the phone over Tailscale.
- [ ] Replies stream under one `id` with the full text each time, and end with `streaming: false`.
- [ ] Every tool `call` ends with a `done`.
- [ ] The user's own message is echoed back with its `id`.
- [ ] `approve` and `reject` change the approval's `status`, and the bell updates.
- [ ] `interrupt` stops a reply mid-stream, and it ends with `interrupted: true`.
- [ ] `vitals` arrive about once a second. `metrics` are real, with no `sample` field.

## Backend additions beyond the base protocol (implemented on the PC, 2026-11-17)

### Reply readouts on the final `message`

The final frame (`streaming: false`) carries the real numbers, so the UI shows them instead of its estimates:

```json
{ "type": "message", "data": { "id": "m_42", "role": "leo", "text": "…", "streaming": false,
  "tokens": 312, "ms": 4870 } }
```

- `tokens`: output tokens of this reply (Ollama's `eval_count` for the local brain, Claude's `usage.output_tokens`
  summed over the turn's steps). Omitted when unknown.
- `ms`: milliseconds from the user's `send` reaching ORION to the final frame.

### `route`: which brain answers

Sent to the asking device as soon as the turn is routed, and again if ORION re-routes mid-turn (a connector task the
local brain skipped, or a withdrawn "I cannot" reply handed to Claude):

```json
{ "type": "route", "data": { "tier": "local" | "haiku" | "sonnet", "reason": "quick request", "id": "m_42", "at": 1763251200000 } }
```

`id` is the reply message id the tier applies to. `reason` is a short phrase for tooltips.

### Everything else

Accounts, login, watch lists, briefs, Local / Local+, the admin view and account management: see `ACCOUNTS.md`.
The `text: ""` reset mid-stream and the no-markdown guarantee: see `CLAUDE.md`.

## Proposed (not yet in the backend)

Written by the UI session on 2026-11-17. All of these are additions: new optional fields on existing frames, or new
frame types. Unknown fields and types are ignored on both sides, so nothing breaks before the backend has them.

### 1. Times on tasks (fills the Tasks page's Daily and Scheduled tabs)

The Tasks page has three tabs: **Always** (the watch list), **Daily** (routines) and **Scheduled** (a month calendar).
Daily and Scheduled need to know when things happen. Add optional fields to `task`:

```json
{ "type": "task", "data": { "id": "routine_morning_brief", "title": "Morning brief", "source": "Routine",
  "status": "queued", "every": "day at 07:30", "next": 1763364600000 } }
{ "type": "task", "data": { "id": "timer_tea", "title": "Tea is ready", "source": "Timer",
  "status": "queued", "due": 1763300000000 } }
```

- `every`: human words for the repeat ("day at 07:30", "6 hours"). Routines only.
- `next`: epoch ms of the next run (routines). `due`: epoch ms of a timer or dated reminder.
- Send one `task` per routine and per pending timer/reminder of the account in `snapshot.tasks`, and update `next`
  after each run. A finished timer/reminder goes to `status: "done"`.
- Guests get their own timers/reminders; owner routines never reach a guest.

### 2. "Describe your task": new tasks from the Tasks page

Each tab has a New button. The person describes the task in plain words, and the UI sends an ordinary `send`
with a short note in front **and** a `task` hint field:

```json
{ "type": "send", "data": { "id": "m_51", "text": "[New task · Daily: do this every day] Sum up last night's orders at 7",
  "voice": false, "task": { "kind": "daily" } } }
{ "type": "send", "data": { "id": "m_52", "text": "[New task · Scheduled for Monday 2026-12-14] Remind me to renew the domain",
  "voice": false, "task": { "kind": "scheduled", "date": "2026-12-14" } } }
```

- `task.kind`: `"always"` -> add a watch item (`watch_add`), `"daily"` -> create a routine at the time the text names
  (or a sensible default), `"scheduled"` -> a dated reminder on `task.date` (any distance ahead: weeks or months),
  at the time the text names, else 09:00 local.
- ORION confirms in a short reply and sends the matching `watch` or `task` frame so it appears on the right tab.
- Without the `task` field (older UI), the bracketed note in the text says the same thing.

### 3. Files ORION made (owner only)

A panel lists the files in ORION's workspace and lets the owner download them, over the socket so the login
(name + password) is enough and no HTTP token or CORS is needed:

```json
{ "type": "files_list", "data": {} }
{ "type": "files", "data": { "items": [ { "path": "exports/chat-2026-11-17.txt", "name": "chat-2026-11-17.txt",
  "size": 4210, "modified": 1763300000000, "kind": "text" } ] } }
{ "type": "file_get", "data": { "path": "exports/chat-2026-11-17.txt" } }
{ "type": "file", "data": { "path": "exports/chat-2026-11-17.txt", "name": "chat-2026-11-17.txt",
  "mime": "text/plain", "data": "<base64>" } }
```

- `items` newest first, the `files/` workspace only (not Documents/Desktop). `kind`: text, sheet, image, pdf, doc, other.
- `file_get` on a file over 15 MB, or outside the workspace: `file {path, error}`.
- Send `files` again (unasked) when ORION creates a new file, so the panel updates.
- Guests: `files {items: []}`.

### 4. Your rules (style rules over the socket)

The "from now on…" rules in each account's STYLE.md, listed and removable in the UI:

```json
{ "type": "style_list", "data": {} }
{ "type": "style", "data": { "items": [ { "id": "s3", "text": "Keep replies under three sentences" } ] } }
{ "type": "style_add", "data": { "text": "Call me Commander" } }
{ "type": "style_remove", "data": { "id": "s3" } }
```

Every change replies with the full `style` list. Per account; guests manage their own.

### 5. Pictures in chat

The local model has vision. The composer can attach up to 4 pictures, resized in the browser to at most
1600 px on the long side (JPEG, usually under 500 KB):

```json
{ "type": "send", "data": { "id": "m_53", "text": "What plant is this?", "voice": false,
  "images": [ { "name": "IMG_2041.jpg", "mime": "image/jpeg", "data": "<base64>" } ] } }
```

- Treat each image like `file_read` on a picture: the local model describes it, a cloud turn gets the image block.
- `text` may be empty when only a picture is sent.
- Reject anything over 4 images or 6 MB in total with an `error` frame.

### 6. Sources on web answers (optional, nicer than parsing)

Web answers end with a "Sources" line today; the UI turns that line into small links. If the final `message`
also carried `sources: [{title, url}]`, the UI would use that instead of parsing the text.

### 7. `admin_snapshot.telemetry` shape

The admin page draws whatever `telemetry` holds. Please document its fields here (the UI looks for per-tier counts,
`cost_usd`, average `ms`, retries, escalations and withdrawals over today / 7 days).
