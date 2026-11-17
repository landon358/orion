# CLAUDE.md: read this before changing anything in this repo

This repo is **only the ORION UI** (static site, GitHub Pages at https://landon358.github.io/orion/).
The backend already exists, is live, and speaks `ORION-PROTOCOL.md` exactly. Your job when editing
here is to improve the UI **without changing the wire contract**. If a UI change needs the backend
to change, see "Changing the protocol" below. Do not guess what the backend does; it is written down here.

## Where the backend is

- Orion runs on Landon's Windows PC in `C:\Users\lando\orion` (Python 3.12, FastAPI, Ollama with a local
  qwen3.5 9B that also has vision, plus Claude Haiku 5.5 / Sonnet 5.5). It is not in this repo and not on GitHub.
  Its own overview for coding assistants is `ARCHITECTURE.md` in that folder (document map, account model,
  Local/Local+, always-on layer, bridge, tests, rules); `CLAUDE.md` there holds the backend session rules.
- The protocol implementation is `orion/bridge.py` there (one file, about 800 lines, with a table of how
  each Orion event becomes a UI frame). `orion_server.py` serves it:
  - `ws://localhost:8765/` (root) and `ws://localhost:8765/ws`: the UI port, in the same process as the
    HTTP API, so there is exactly one Orion state. `tailscale funnel --bg 8765` (public) or
    `tailscale serve --bg 8765` (tailnet only) exposes it as `wss://<pc>.<tailnet>.ts.net` for phones.
  - `ws://localhost:8766/ws`: the same bridge on the HTTP API port (handy for local tests).
- Its own test of this contract: `tests/test_ui_bridge.py` on the PC, 41 live checks (origin, 4401 and
  lockout, snapshot, streaming under one id, tools, interrupt, listening, approvals, per-device chat,
  name+password login, watch lists, briefs, admin view, account management, Local/Local+ switches).

## Current state of Orion (2026-11-16), so the UI matches what exists

- **Accounts**: the owner (name "Owner", login by password or token) and 14 guest accounts, one per
  friend, username = first name (two Evans: `Evan` and `EvanSing`), each addressed by their first name.
  Guests are chat-only: four bands, their own facts, watch list, brief, style rules, 10-cent cloud
  allowance, nothing that acts on the PC or touches the owner's data. Owner devices can open the admin
  view (`admin {on}`) and manage accounts over the socket (ACCOUNTS.md).
- **Brains**: local 9B for chat, commands, memory, heartbeat and most tool calls (free); Claude Haiku for
  research, drafting, analysis and the morning brief; Sonnet for deep dives (owner only). **Local / Local+**:
  the owner's master switch, each account's own switch and the budget must all allow Claude (`cloud`,
  `cloud_master` frames; `snapshot.cloud` says which mode and why). Weekly budget 5 dollars.
- **Attempt first**: the backend now repairs the model's tool arguments, hands a connector task to Haiku
  when the local brain skips the tool, and withdraws a local reply that claims "I cannot" (the `text: ""`
  reset described below) so Haiku can redo it. Replies never contain markdown.
- **Connectors connected**: email (Gmail, read + drafts, never sends on its own), github, clarity (the
  CIEL site), files (read md/txt/csv/xlsx/pdf/docx/images, create text files and spreadsheets, export the
  chat), desktop and browser control. **Pending**: shopify (read-only, waiting for the store token).
  **Not connected**: meta_ads, bambu (3D printer), fusion360. `metrics` for the business page is still
  omitted; Shopify will feed it once connected.
- **Memory**: `brain/SELF.md` (Orion's own account of itself), `brain/OWNER.md` (the owner's profile:
  CIEL, friends, tools, preferences, owner-only), `brain/STYLE.md` per account (standing reply rules),
  `HEARTBEAT.md` per account (the watch list), facts, journals, reports, workflows, notes, proposals.
  The HTTP API reads and edits them (`GET/PUT /memory/file`); the socket covers watch lists and briefs.
- **Hosting**: GitHub Pages today; moving to Netlify with the login screen (GO-LIVE.md). The default server
  in `js/config.js` should be the PC's Funnel address; `orion_connect.py ui-url <netlify url>` on the PC
  adds the new origin.
- **Voice**: phase 1 (browser speaks). Kokoro (EN/FR) exists on the PC but server audio over the socket is
  not designed.

## The contract (protocol 1), as the backend implements it

Everything in `ORION-PROTOCOL.md` is implemented. Details that matter when you edit `js/leo-client.js`
or anything that reads these frames:

| Backend behaviour | Do not change on the UI side |
|---|---|
| First frame must be `hello` within 5 s, else close **4401**: `{name, password, client, protocol}` (any account) or `{token, …}` (owner token, guest token, or the owner's password alone). Bad login: 4401; after 5 failures from one address, 4401 for 10 minutes. Bad `Origin`: HTTP 403 before the upgrade. | Send `hello` first; stop retrying on 4401 and show the login screen; keep the `?server=&token=` bootstrap and the `orion-server` localStorage key. See GO-LIVE.md (login screen, default server) and **ACCOUNTS.md** (accounts, watch list, brief, admin view). |
| `snapshot` also carries `account` (`id, name, role, address, allowance_left_usd, features`), `watch`, `cloud` (Local / Local+ status) and sometimes `brief`. Extra commands: `watch_add/remove/list`, `brief`, `cloud {on}`, and owner-only `cloud_master {on}`, `admin`, `account_add/update/remove/list`. Extra events: `watch`, `brief`, `cloud`, `accounts`, `admin_snapshot`, `admin_event`. | Build the UI from `account.features`; guests get four bands and never `metrics`. Full shapes in ACCOUNTS.md. |
| Allowed origins are a backend setting (`config.json` -> `server.ui_origins`): `https://landon358.github.io` and `http://localhost:8840`. | If the site moves (Netlify, custom domain), the new origin has to be added on the PC; nothing in the UI can fix a 403. |
| `snapshot` after hello: `{protocol: 1, speaks: false, state, tools, tasks, approvals, activity, vitals}`. `metrics` is **omitted** (no Shopify or Meta data yet). | Keep the "sample data" note logic for a missing `metrics`; never expect `metrics` to be present. |
| `tools` are 11 bands for the owner, innermost first: `memory, planner, web, files, voice, email, shopify, meta, clarity, github, printer` (+`calls`, `lastUsed`); a guest gets `memory, planner, web, voice`. All eleven have icons in the UI (`js/app.js` ICON, names and groups in `js/tools.js`); an unknown id gets the generic icon. The `files` band ("Machine") now also covers Orion's file tools: reading documents, spreadsheets, PDFs and images, creating text files and spreadsheets in its `files/` workspace, exporting the chat. The HTTP API (not the socket) serves those files: `GET /files`, `GET /files/download?path=` with the owner token. | Do not hard-code the tool list; render whatever `tools` ORION sends. A "files Orion made" panel would use the HTTP endpoints; a socket frame for it would be a protocol proposal. |
| Reply streaming: `message` `{id, role: "leo", text: <full text so far>, streaming: true}` repeatedly, then one frame with `streaming: false` (and `interrupted: true` after an `interrupt`, text ending in " —"). The text can **shrink to ""** mid-stream under the same id: that is Orion withdrawing a local reply and handing the turn to the cloud brain (a `state thinking` with detail "Claude Haiku" follows, then the new text streams). Replies carry no markdown (the backend strips bold, italics, headings and star bullets; lists come as "1." or "- " lines). | Full-text-so-far semantics, one id per reply, `role: "leo"` (the role name stays "leo" for compatibility; renaming it needs a backend change). Always render the latest `text` as a whole, never append deltas yourself; do not rely on markdown rendering. |
| Chat display is **per device**: the user's `send` is echoed back as `message` `{id: <same id>, role: "user", text, voice}` and the reply is streamed only to the device that sent it. Other devices of the same person still get `state`, `tool`, `activity`, `task`, `approval`, `notify` and `vitals`. Orion's conversation memory is still one shared thread per person. (`server.ui_shared_chat: true` on the PC switches to mirroring every message to every device, as the original brief described.) | Keep ignoring your own echoed id. Do not assume another device's messages will appear. |
| `state` sequence per turn: `thinking` (detail names the brain: "local brain", "Claude Haiku", "Claude Sonnet") -> `working` while tools run (label is the tool, detail its argument) -> `speaking` ("Replying" or "Speaking" for voice) -> `idle`, or `needs-you` when an approval is pending. The trailing `state` arrives **after** the final `message` frame. | Nothing in the UI should assume `idle` before the final message. |
| `tool` frames: `call` -> `result` -> `done`, always ending in `done`; `tool` is a band id above. `activity` kinds used: `tool`, `search` (web search, page read, Wikipedia), `think` (heartbeat), `done` (notifications, routine results, brief), `approval`, `rejected` (blocked actions, errors, rejected approvals). | |
| Approvals come from Orion's safety layer: `approval` `{id, title, source, summary, preview, status: "pending"}` + `task` with the same id and `status: "needs-you"` + `notify`. `approve`/`reject` resolve it and Orion replies with a new streamed `message`. | Keep sending `approve`/`reject` with the approval `id`. There is no "remember this decision" over the WebSocket yet (the HTTP API has it). |
| `vitals` every second to connected clients: `{gpu, vram, vramTotal, temp, tps, ctx, uptime, queue, model}`; `ctx` is an estimate, `tps` is measured on the last reply, `model` is like `"qwen3.5-9b · Q4_K_M"`. | |
| Background work arrives as `activity` + `notify` + `task` (routines, timers, the heartbeat, the morning brief, the memory inbox). Tasks for routines have ids `routine_<name>`, timers `timer_<label>`. | |
| `listening {on}` only toggles `idle` <-> `listening`. `interrupt {}` stops the current reply. Unknown frame types are ignored in both directions. | |
| `speaks` is `false` (voice phase 1: the browser speaks). Orion has its own Kokoro voice (English and French) but phase 2 (server audio over the socket) is not designed yet. | Do not build phase 2 UI assumptions without agreeing the audio transport with the backend first. |
| Guests: every account is a room; devices of the same account share it; nobody sees another room except the owner's admin view (`admin_event` mirrors everything). A guest gets chat, research, timers, their own facts, their own watch list and brief, their own style rules, a 10-cent cloud allowance, and nothing that touches the PC, connectors, settings or Orion's own files. | Hide owner-only UI when `account.features.actions` is false. |
| Style rules: every account has standing reply rules (`STYLE.md` in its brain folder). Saying "from now on, never use asterisks" in chat saves one (tool `style_add`, shown as a `tool` frame on the `memory` band). There is no socket command for them yet; the owner can edit the file through the HTTP API (`PUT /memory/file` path `STYLE.md`). | A "style rules" editor would need a new frame pair (`style_list`/`style`): propose it in ORION-PROTOCOL.md first. |

## Safe to change freely

Anything visual or interactive that stays inside the frames above: pages, layout, colours, the orbit,
animations, icons, copy, the business page layout, the intro, PWA bits. Remember to bump `VERSION` in
`sw.js` so installed copies update.

## Changing the protocol

1. Unknown types are ignored on both sides, so a **new** event or command never breaks anything, but the
   backend will not send or act on it until it is implemented there.
2. Write the proposed addition into `ORION-PROTOCOL.md` under a heading "Proposed (not yet in the backend)"
   with the exact frame shape, and tell Landon. He applies it on the PC side (in `orion/bridge.py`) with
   his coding assistant, then moves it out of "Proposed".
3. Never rename or remove an existing type or field, change the `hello`/4401 handshake, or change the
   meaning of `streaming`, `interrupted`, `id` echoing, or the tool ids, without a matching backend change
   shipped first. Bump `protocol` only together with the backend.

## Testing a UI change against the real backend (on Landon's PC)

```
cd <this repo>            # on the PC
python -m http.server 8840
```
Then open `http://localhost:8840/?server=ws://localhost:8765&token=<TOKEN>` where TOKEN comes from
`C:\Users\lando\orion\.venv\Scripts\python.exe C:\Users\lando\orion\orion_connect.py token`
(`orion_connect.py ui-link` prints both the local and the Tailscale link). Orion's services must be
running (`powershell -File start-orion.ps1` in the orion folder). Node is not installed on the PC, so use
Python's http.server rather than `npx serve`; the Node reference server `tools/orion-server-example.mjs`
is only a stand-in and is no longer needed.

From any other machine, the reference server is still the quickest way to see the frames; it matches the
base protocol but not the 11-band tool list, the account/watch/brief/cloud/admin additions, the per-device
chat display, the `text: ""` reset, or the real Orion replies. When in doubt, the backend's behaviour is
what this file and ACCOUNTS.md say, and `tests/test_ui_bridge.py` on the PC is the proof.
