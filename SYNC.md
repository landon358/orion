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
  utilities [planner/web/files], `python_run` and `show_data` [files], `research` and `history_on` [web/memory],
  `news_headlines`, `stock_quote`, `sports_scores` [web] (added 2026-11-17 evening, free public feeds, guests too),
  `person_note`, `person_card`, `people_list` [memory] (people cards, same evening).
- Phone push is done on the backend (2026-11-17 evening, `orion/push.py`): the owner's `notify`-class events
  (reminders, heartbeat, routine results, brief) and approvals are sent to a phone through ntfy or Twilio SMS when no
  owner device has sent a frame in the last two minutes. No UI change and no new frame. The UI's Web Push idea is
  therefore not needed; the open item below is closed.

## Open: backend (the PC session owns these)
- Style rules over the socket (`style_list` -> `style {items}`, `style_add {text}`, `style_remove {id}`) if the UI
  wants an editor; today STYLE.md is editable through HTTP `PUT /memory/file`. Not started; propose the shape here
  or in ORION-PROTOCOL.md "Proposed" and the backend will add it.
- Files Orion made: HTTP `GET /files` and `GET /files/download?path=` exist (owner token). A socket frame listing new
  files (`files {items}`) could be added if the UI wants a panel.

- **Requested by the UI (2026-11-17), shapes in ORION-PROTOCOL.md "Proposed":** (1) `every`/`next`/`due` on
  routine, timer and reminder tasks, so the new Tasks page's Daily and Scheduled tabs fill in; (2) the
  "Describe your task" `send` with a `task {kind, date?}` hint: always -> watch item, daily -> routine,
  scheduled -> dated reminder any distance ahead; (3) `files_list` / `file_get` -> `files` / `file` for the
  owner's Files panel; (4) `style_list` / `style_add` / `style_remove` -> `style` for the "Your rules" screen;
  (5) `images` on `send` for pictures in chat; (6) optional `sources` on the final message; (7) document the
  `telemetry` fields in the admin snapshot.

- **Email alerts (requested 2026-11-17).** UI is built (pop-up + top-bar button); frames in ORION-PROTOCOL.md
  "Proposed" 5b. Landon chose email over SMS for everyone. The natural home is a new email channel in
  `orion/push.py` (same quiet hours, dedupe and "skip while a device is active" logic), but for **every account**,
  each to their own verified address; push.py's ntfy/SMS stay owner-only. Backend to build:
  1. **Sending address:** a dedicated Gmail account for ORION (not the owner's own Gmail, which stays the
     read-and-draft connector). Display name "ORION". Turn on 2-step verification, make an app password, store it in
     Credential Manager (`Orion-assistant / email:smtp_password`, address in `config.json`), send over
     `smtp.gmail.com:587` STARTTLS. Gmail allows about 500 messages a day; the expected volume is about 50 a week.
     (Alternative later: a custom-domain address through Resend's free tier, 100/day, with SPF/DKIM.)
  2. **Storage:** each account's address, verified flag and on/off in `data/users.json` (PC only, never in this
     repo). Codes hashed, 15-minute expiry, the rate limits in 5b.
  3. **What gets emailed:** that account's own `notify` events: watch-list hits, finished timers, due reminders,
     the owner's "needs your OK" approvals (summary only, never the full preview of a draft), and opt-in reports
     (Kyle's morning report, if the owner approves the cost; see GUEST-PROFILES.md).
     Not emailed: chat replies, routine noise, anything for another account.
  4. **Limits:** at most 3 emails per account per day and 10 a day overall by default (configurable), quiet hours
     22:00 to 07:00 local (hold and send at 07:00), and bundle anything that arrives within 10 minutes into one
     email. Skip the email if that account has a device connected and active in the last 2 minutes.
  5. **The email itself:** plain text plus simple HTML, subject under 60 characters ("ORION: Order #1043 hasn't
     shipped"), two or three lines, a link to open ORION (the site URL), and a one-click unsubscribe link
     (`List-Unsubscribe` header + a footer link to an HTTP endpoint on the Funnel that sets `on: false`).
     Run it through the privacy redaction first. Never include tokens, passwords or login links.
  6. **Replies:** emails to ORION's address are not read as commands (anyone can forge a sender). Optionally
     forward them to the owner.
  7. **Tests:** code expiry and lockout, guest isolation (one account never triggers another's email), quiet hours,
     caps, unsubscribe link.

## Open: UI (this repo's session owns these)

- Done 2026-11-17: `js/tools.js` lists 11 bands; `files` skills are Read / Create; Shopify is marked read-only.
- Done 2026-11-17: the Files panel and "Your rules" are built in ORION's panel, waiting on the proposed frames
  above (the HTTP `/files` endpoints need the owner token, which a name + password login doesn't have).
- The Business page can keep its sample note until `metrics` arrives; nothing to change. When Shopify lands, the
  backend's `days` will start with Shopify history (orders/revenue for 60 days) but `sessions`/`studio`/`carts`/
  `checkouts` only from the day Clarity collection started, so early days may be zero there.
- Voice phase 2 (server audio): still undesigned on both sides.

## How each side tests against the other

- Backend: `tests/test_ui_bridge.py` on the PC (43 live checks) proves every frame above against the running server.
- UI: serve this repo on `localhost:8840` and open `?server=ws://localhost:8765&token=<owner token>` on the PC, or
  use the live Funnel address from anywhere with the login screen.
