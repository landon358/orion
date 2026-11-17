# SYNC.md: backend and UI, what matches and what is still open

Written by the backend session on 2026-11-17 after reading UI commit 039aaa5 ("Ring sphere, retro side orb, and a
full-screen Tasks page"). Two coding sessions work on ORION in parallel: the UI (this repo) and the backend on the PC.
This file is the hand-off list between them. Each item names its owner. Update it when you close one.

## Matches (checked against the running backend, nothing to do)

- Login: `hello {name, password}` or `{token}`, 4401 on a bad login, lockout after 5 failures. The UI's login screen
  and `needsLogin` flow fit. `DEFAULT_SERVER` in `js/config.js` is the PC's Tailscale Funnel address and Funnel is on.
- Snapshot fields the client reads: `tools, tasks, approvals, activity, metrics?, vitals, speaks, account, brief,
  watch, cloud`. All sent (metrics only once Shopify is connected, see below).
- Commands the client sends: `send, approve, reject, listening, interrupt, brief, watch_add {text}, watch_remove {id}`,
  `watch_list, cloud {on}, cloud_master {on}, admin {on}, account_add/update/remove/list`. All handled; `watch_remove`
  accepts `id` ("w3"), `n` or `text`.
- Events: `state, message, tool, tools, task, approval, activity, vitals, notify, brief {text, at, fresh},
  watch {items[{id, n, text}], every_minutes}, cloud, accounts {accounts, created?, removed?}, admin_snapshot,
  admin_event, error`. All sent with those shapes.
- Admin page: `admin_snapshot.accounts[]` has `online, state, last_seen, allowance_left_usd, budget_usd, facts,
  watch_items, pending_approvals, cloud_mode`; `budget` has `cap_usd, spent_usd, remaining_usd, today_usd,
  by_account`; `heartbeat` has `every_minutes, checks_today, alerts_today, last, next`; `routines[]` have
  `name, every|at, last_run, status`; `integrations` is `{name: status string}`; `audit[]` rows have
  `ts, user, tool, risk, outcome`; `safe_mode, cloud_master, cloud_configured`.
- Per-device chat, `text: ""` reset when the cloud brain takes over, no markdown in replies: as CLAUDE.md says.

## Done on the backend for this UI draft (2026-11-17)

- `route {tier, reason, id}` event per reply (the brain tag and the orb tint). Also sent on a mid-turn re-route.
- Real `tokens` and `ms` on the final `message` frame (was "Proposed" in ORION-PROTOCOL.md; now implemented).
- `budget.today_usd` and `budget.by_account`, `heartbeat.checks_today / alerts_today / last / next` in the admin snapshot.

## Done on the backend overnight (2026-11-17, see the PC's OVERNIGHT.md)

- `metrics` is implemented and dormant: the moment Shopify is connected, `snapshot.metrics` and `metrics` frames
  (owner only) carry 60 days of Shopify orders/revenue, recent orders, top products, Clarity sessions and a
  URL-based funnel per day (accumulated from the day of connection), Meta spend when that connector exists. No
  `sample` field. **UI note:** `kpis.rating` / `kpis.reviews` have no data source and arrive as `0` / `0`; hide the
  "★ rating from N reviews" fragment when `reviews` is 0. `spend` and `campaigns` stay 0 / empty until Meta Ads is
  connected.
- Replies are shorter and cleaner: padding sentences and emoji are stripped on the backend, an `ack` line
  ("Checking your email, Commander.") appears under the reply id as soon as the first tool runs and is replaced by
  the reply (text may shrink; render the latest text, as CLAUDE.md says).
- New tool families the activity log will show (band in brackets): lists and reminders [planner], unit/currency/date
  utilities [planner/web/files], `python_run` and `show_data` [files], `research` and `history_on` [web/memory].

## Open: backend (the PC session owns these)
- Style rules over the socket (`style_list` -> `style {items}`, `style_add {text}`, `style_remove {id}`) if the UI
  wants an editor; today STYLE.md is editable through HTTP `PUT /memory/file`. Not started; propose the shape here
  or in ORION-PROTOCOL.md "Proposed" and the backend will add it.
- Files Orion made: HTTP `GET /files` and `GET /files/download?path=` exist (owner token). A socket frame listing new
  files (`files {items}`) could be added if the UI wants a panel.

## Open: UI (this repo's session owns these)

- `js/tools.js` header comment still says 10 bands and lists `shopify` under "older ids": the backend sends 11 bands
  for the owner (`memory, planner, web, files, voice, email, shopify, meta, clarity, github, printer`) and `shopify`
  is live (read-only CIEL store once connected). Cosmetic.
- `files` band: the backend now reads documents, spreadsheets, PDFs and images and creates text files and
  spreadsheets. Its skills line (`Downloads`, `Briefs`) could say `Read`, `Create` and the group "ORION machine" fits.
- The Business page can keep its sample note until `metrics` arrives; nothing to change. When Shopify lands, the
  backend's `days` will start with Shopify history (orders/revenue for 60 days) but `sessions`/`studio`/`carts`/
  `checkouts` only from the day Clarity collection started, so early days may be zero there.
- Phone push: `notify` frames exist, push does not. Needs a UI subscription (Web Push) and a proposed frame to send
  the subscription to the backend, or an ntfy topic; Landon decides.
- Voice phase 2 (server audio): still undesigned on both sides.

## How each side tests against the other

- Backend: `tests/test_ui_bridge.py` on the PC (43 live checks) proves every frame above against the running server.
- UI: serve this repo on `localhost:8840` and open `?server=ws://localhost:8765&token=<owner token>` on the PC, or
  use the live Funnel address from anywhere with the login screen.
