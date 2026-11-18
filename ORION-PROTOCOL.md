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

### `opening`: the first line in the chat box (added 2026-11-18, Landon's request)

When a device connects, the chat box should open with Orion's "while you were away" summary instead of a fixed
greeting. `snapshot.opening` carries it, and an `opening` event replaces it if a fresher one is produced right after
connect:

```json
"opening": { "text": "Evening, Commander. Since 14:02: the tea timer finished and Kyle's watch item fired ...", "at": 1763300000000, "kind": "brief" }
{ "type": "opening", "data": { "text": "...", "at": 1763300060000, "kind": "brief" } }
```

- `kind: "brief"`: the account's current "while you were away" summary (local model, free, covers what happened since
  `last_seen`: alerts, finished timers, routine results, approvals waiting, the watch list; the owner's also notes
  the memory inbox and today's morning brief). The backend keeps it current in the background while the person is
  away (regenerated at most every 20 minutes when something new happened), so it is usually ready in the snapshot.
- `kind: "greeting"`: code-built fallback when no current summary exists ("Evening, Commander. 2 alerts, 1 timer
  running since 14:02." or "Evening, Commander. Nothing new since you were last here."). A `brief` + `opening` event
  with `kind: "brief"` follows a few seconds later.
- Show `opening.text` as Orion's first line in the conversation; on an `opening` event replace that line (it is not
  a `message`, so nothing is stored in the conversation history). The home page's "while you were gone" card keeps
  using `brief` as before; the owner's `brief {}` command still returns the morning brief.

### Everything else

Accounts, login, watch lists, briefs, Local / Local+, the admin view and account management: see `ACCOUNTS.md`.
The `text: ""` reset mid-stream and the no-markdown guarantee: see `CLAUDE.md`.

## Implemented on the backend 2026-11-18 (proposed by the UI session on 2026-11-17)

All of these are additions: new optional fields on existing frames, or new frame types. Unknown fields and types are
ignored on both sides. Every item below is live on the PC and covered by `tests/test_ui_bridge.py` there; the
"Backend notes" under each section say exactly what the backend sends where it differs from the proposal.

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

**Backend notes.** Ids and sources as sent: routines `routine_<name>` with `source: "Routine"` (or `"Reminder"` for a
recurring reminder made in chat), `every` (human words: "day at 07:30", "mon/wed at 08:00", "6h"), `next` (epoch ms) and
`last` (ISO time of the last run) when known; dated reminders `reminder_<name>` with `source: "Planner"`, `due` (epoch ms),
`status: queued` then `done`; timers `timer_<label>` with `source: "Timer"`, `status: running`, `due`. The backend
re-sends the changed tasks after any turn that used set_timer / cancel_timer / remind_at / remind_on / routine_add /
routine_remove, and when a timer finishes (`status: done`). A `task` for a running workflow has id `wf_<run>` and
`source: "Workflows"` (see SYNC.md). A background job (2026-11-18: the person said "in the background", "when you have
a moment", "no rush" with a request) is a `task` with id `job_<id>`, `source: "Jobs"`, `title: "Job 3: <request>"`,
`status` `queued` -> `running` (progress 0.5) -> `done` (progress 1) or `rejected` (failed, cancelled, lost), and on
done/failed a `detail` with the result's first 200 characters, an `activity` line (`done` / `rejected`) and a `notify`
("Job done" / "Job failed"). The request itself was answered at once with "Queued as job 3: ...".

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

**Backend notes.** With the `task` hint, code decides and no model runs (the `route` frame says `reason: "task hint"`):
`always` -> `watch_add`; `daily` -> a routine at the time named in the text (`at 7`, `3pm`, default 09:00), or a
recurring reminder when the text says "remind me"; `scheduled` -> a dated reminder on `task.date` at the time named
(default 09:00), any distance ahead (owner: a one-off routine; a guest gets a timer, so at most 60 days ahead). Guests
cannot have routines: a guest's `daily` becomes a watch item and the reply says so. The bracketed note is stripped
before the text is used.

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

**Backend notes.** As proposed. `files` is re-sent after any turn that used file_write, sheet_create, sheet_append,
export_chat or python_run. The `chat/` subfolder (pictures sent in chat, kept 7 days) is left out of the list.

### 4. Your rules (style rules over the socket)

The "from now on…" rules in each account's STYLE.md, listed and removable in the UI:

```json
{ "type": "style_list", "data": {} }
{ "type": "style", "data": { "items": [ { "id": "s3", "text": "Keep replies under three sentences" } ] } }
{ "type": "style_add", "data": { "text": "Call me Commander" } }
{ "type": "style_remove", "data": { "id": "s3" } }
```

Every change replies with the full `style` list. Per account; guests manage their own.

**Backend notes.** As proposed; items also carry `n` (1-based position) and a change reply carries `result` (the
sentence Orion would say: "Noted...", "Already a standing rule...", "The style list is full (12 rules)..."). `style_remove`
accepts `id` ("s3"), `n` or `text`.

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

**Backend notes.** As proposed. The echoed user `message` carries `images: [<saved file name>, ...]`. Each picture shows
in the activity log as a tool call `image_look` on the `files` band before the reply. Pictures are saved under the
workspace's `chat/` folder for 7 days.

### 5b. Email alerts (every account; chosen instead of SMS on 2026-11-17)

Each person can give an email address and get their own alerts there. The UI asks once after login (and from an
envelope button in the top bar), then confirms the address with a 6-digit code ORION emails, so nobody can sign
someone else up.

```json
{ "type": "email_set",    "data": { "email": "kyle@example.com" } }
{ "type": "email_verify", "data": { "code": "482913" } }
{ "type": "email_on",     "data": { "on": false } }
{ "type": "email_remove", "data": {} }

{ "type": "email_alerts", "data": { "email": "kyle@example.com", "verified": false, "on": false, "sent": true } }
{ "type": "email_alerts", "data": { "email": "kyle@example.com", "verified": true,  "on": true } }
{ "type": "email_alerts", "data": { "email": "kyle@example.com", "verified": false, "on": false,
  "error": "That code isn’t right. Check the latest email from ORION." } }
{ "type": "email_alerts", "data": { "email": null, "verified": false, "on": false } }
```

- `snapshot.email_alerts` carries the same object (or is omitted when the account has none).
- `email_set`: validate the address, send a 6-digit code that expires after 15 minutes, reply with `sent: true`.
  Rate-limit: at most 3 codes per account per hour (`error` otherwise). A new `email_set` replaces an unverified
  address; changing a verified address needs the new code before it takes over.
- `email_verify`: 5 wrong codes lock it for an hour. A correct code sets `verified: true, on: true`.
- `email_on {on}` pauses or resumes; `email_remove` forgets the address.
- Every reply goes to all devices of that account, so a second device's dialog stays in step.

**Backend notes.** As proposed, with: while a code is pending the object shows the *new* address with
`verified: false, on: false, pending: true`; a verified address stays in force until the new code is confirmed, and if
the code expires the object goes back to the verified address. `snapshot.email_alerts` is omitted until the account
has an address. Errors (exact text): "That does not look like an email address.", "Email alerts are not set up on
Orion yet. The owner runs orion_connect.py email-alerts first.", "Too many codes in the last hour. Try again later.",
"That code isn’t right. Check the latest email from ORION.", "Five wrong codes. Verification is locked for an hour.",
"Too many wrong codes. Verification is locked for an hour.", "That code has expired. Ask for a new one.", "Verify an
address first." What gets emailed and when is in SYNC.md ("Email alerts"); the sender is Resend (EMAIL-SETUP.md) or a
Gmail made for ORION. One-click unsubscribe links point at the PC's Funnel address (`/u/<account>/<token>`) and only
turn alerts off.

### 6. Sources on web answers (optional, nicer than parsing)

Web answers end with a "Sources" line today; the UI turns that line into small links. If the final `message`
also carried `sources: [{title, url}]`, the UI would use that instead of parsing the text.

**Backend notes.** The final `message` carries `sources: [{title, url}]` (up to 6) whenever the turn read pages:
`fetch_page` calls (title = the domain), Wikipedia lookups, and the URLs inside `research` results. Omitted when empty.

### 7. `admin_snapshot.telemetry` shape

`telemetry` is today's summary and `telemetry_7d` the last seven days, both the same shape (from
`orion/telemetry.py`, one row per turn in `data/turns.sqlite`):

```json
{ "days": 1, "turns": 42,
  "by_tier": { "local": 38, "haiku": 4 }, "local_share": 0.905,
  "cost_by_tier_usd": { "local": 0, "haiku": 0.0312 }, "cost_usd": 0.0312,
  "tool_turns": 25, "top_tools": [["get_weather", 6], ["set_timer", 4]],
  "repairs": 3, "retries": 1, "withdrawn": 1, "withdrawn_rate": 0.024,
  "escalated": 2, "escalation_reasons": { "local reply claimed inability": 1, "tool failed twice": 1 },
  "errors": 0, "median_first_token_s": 0.9, "median_total_s": 3.4 }
```

- `turns` per tier are in `by_tier`; `repairs` = tool arguments the backend had to fix; `retries` = tool calls retried
  after an error; `withdrawn` = local replies taken back and redone by Claude; `escalated` = turns handed to Claude after
  the local brain failed, with the reasons; latency is in seconds (medians), not ms.
- With no turns in the window the object is `{ "days": 1, "turns": 0 }`.
- `admin_snapshot.email_alerts` is `{ configured, from, sent_today, queued, accounts, last_error }` for the email channel.

## Implemented on the backend 2026-11-18 (evening): scheduled tasks, profile, results in chat

Landon's request: tasks are how ORION acts on his own. Before this, "run a research report on NVIDIA at 12pm" became a
reminder to the person; now it is work ORION does at that time, for the owner and for guests, and the result comes back
to them. The UI in this repo was updated by the backend session the same evening (`js/profile.js`, Tasks page copy and
rows, `js/leo-client.js`, `index.html`, `css/app.css`, `sw.js` v54), so both sides are in step.

### 1. Scheduled tasks: ORION does the work at the time

- **From the Tasks page** (the `send` + `task {kind, date?}` hint of section 2 above): `daily` and `scheduled` now create a
  *scheduled task* (a routine with action `run`) unless the words ask for a reminder ("remind me", "tell me to", "don't
  forget"). `always` is still a watch item. Guests get the same (before, a guest's daily became a watch item and their
  scheduled a 60-day timer). The reply is code: "Scheduled: I will research X every day at 7:00 AM and report back, Commander."
- **From chat**: a sentence that is clearly "do X at a time" ("every morning at 8, summarize the AI news", "research the
  best budget printers tomorrow at 9", "every 2 hours check the NVIDIA stock price") is scheduled by code too (`route`
  says `reason: "task hint"`); otherwise the models have the tools `schedule_task {text, when}`, `task_list`, `task_remove
  {item}` (every account) and `remind_at` is described as "only for things the person does". "What's scheduled?" and
  "Remove my scheduled task: <words>" are answered by code.
- **When it is due** the request is queued as a background job for that account and runs as an ordinary turn with that
  account's tools and budget (a guest's job uses guest tools and the guest's allowance; Local+ off keeps it on the free
  local brain). The result reaches the account three ways: the task frame goes `done` with the result as `detail`; a
  `message` frame of ORION's own appears in the conversation (below); a `notify` "Task done" (and an email alert, if the
  account has one, titled "Scheduled task done").
- **Task frames**: a one-off is `{id: "sched_<name>", source: "Scheduled", title: <the request>, due, status: queued ->
  running -> done | rejected, detail?}`; a recurring one is `{id: "routine_<name>", source: "Scheduled", every: "day at 07:00"
  | "mon/tue/wed/thu/fri at 18:00" | "every 2h", next, last?, status, detail?}`. Reminders keep `source: "Planner"` (dated)
  and `"Reminder"` (recurring) and now exist for guests too. Each account's snapshot carries only its own tasks; the
  owner's also has the config.json routines. Re-sent after `schedule_task` / `task_remove` turns and when a job changes state.
- Limits: a guest may hold 10 scheduled tasks and reminders; the job queue allows 3 waiting per account.

### 2. A result ORION brings on his own: `message` with `background`

```json
{ "type": "message", "data": { "id": "job_1a2b3c4d", "role": "leo", "text": "<the result>", "streaming": false,
  "at": 1763300000000, "background": true, "title": "Scheduled task: research the best budget 3D printers" } }
```

Sent to every device of the account when a scheduled task or a background job ("in the background, ...") finishes with
a result. `background: true` and `title` let the UI label it (this repo shows a small kicker above the message). The
text is already in the account's conversation history on the backend (the job ran as a turn), so render it as a normal
reply and do not re-send it. The `id` is the job's; a second frame with the same id never follows.

### 3. Profile: what ORION has on this person, their title, sign out

```json
{ "type": "profile_get",    "data": {} }
{ "type": "profile_update", "data": { "address": "Captain" } }          // "" = back to the default ("Commander")
{ "type": "profile_forget", "data": { "text": "<the exact fact>" } }    // or { "n": 3 } from the list below

{ "type": "profile", "data": {
  "account": { ...the snapshot's account, with the new address... },
  "name": "Kyle", "address": "Captain", "default_address": "Commander", "role": "guest",
  "created": "2026-11-16T20:01:00", "last_seen": "2026-11-18T13:40:12",
  "email_alerts": { "email": "kyle@example.com", "verified": true, "on": true },
  "cloud": { "mode": "local+", "on": true, "reason": "...", "allowance_left_usd": 0.1, ... },
  "facts": [ { "n": 1, "text": "The user likes oolong tea", "category": "general", "saved": "2026-11-18", "source": "chat" } ],
  "facts_total": 7,
  "counts": { "facts": 7, "watch": 1, "rules": 2, "tasks": 3, "journal_days": 4 },
  "about": "<the owner's PROFILE.md note about this guest, or empty>",
  "result": "Noted. I will call you Captain from now on.",      // only after a change
  "at": 1763300000000 } }
```

- `profile_get` answers with the object; the client in this repo asks for it after every snapshot. Every change
  (`profile_update`, `profile_forget`) answers with the full object to all devices of the account, plus `result`
  (a sentence, or "Error: a title is 1 to 30 letters, digits, spaces, apostrophes or hyphens.").
- `address` is validated (1 to 30 characters: letters, digits, spaces, `.`, `'`, `-`); it takes effect on the next reply
  and in the live session. The owner's admin `account_update {address}` does the same and the guest's devices receive a
  `profile`. The owner's `accounts` list is re-sent when a guest changes their own title.
- `facts` are the newest 80 of this account's own memory (`facts.json`), newest first; `profile_forget` removes one by its
  exact text (never a fuzzy match, unlike the chat tool `forget`).
- **Sign out** is a UI matter: forget the saved login on the device and show the login screen (`client.signOut()` in
  `js/leo-client.js`); the backend keeps no per-device state. Same over HTTP: `GET /profile`, `PUT /me {address}`.
- `snapshot.account.features` gained `tasks: true` and `profile: true`.

### 4. Watch list items that need the world

The heartbeat now fetches live information for a watch item about the weather, a stock or crypto price, a team, or the
news (free public feeds) and judges the item against it, for every account; before, "Check NVIDIA stock price daily" was
compared with nothing and never fired. No frame change: alerts still arrive as `notify {title: "Heartbeat"}`.

## Proposed (not yet in the backend)

Nothing at the moment. Add new frame shapes here for Landon to approve.
