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
  `person_note`, `person_card`, `people_list` [memory] (people cards, same evening), `workflow_run` / `workflow_define` /
  `workflow_list` / `workflow_status` / `workflow_resume` [planner] (multi-step plans run by code, owner only).
- Workflow progress uses the existing `task` frame: ids `wf_<run>`, `source: "Workflows"`, `status: running | done | rejected`,
  `progress` 0..1, plus a `detail` field with the current step's sentence. `state` goes `working` with label "Workflow" and the
  step sentence as detail while a step runs. No new frame type.
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

- **Done 2026-11-18 (backend):** every request below is implemented and documented under "Implemented on the backend"
  in ORION-PROTOCOL.md, each with "Backend notes" where the shape differs slightly from the proposal (task ids and
  sources, the `pending` flag on email alerts, `n`/`result` on style lists, `images` echoed on the user message,
  `telemetry_7d`). Guest profiles from GUEST-PROFILES.md are in each guest's own folder (`PROFILE.md`) and ride into
  only that guest's turns. Kyle's morning report and Blake's career notes still need the owner's call on cost (see below).
  Live checks: `tests/test_ui_bridge.py` on the PC, 54 checks.

- **Requested by the UI (2026-11-17), shapes in ORION-PROTOCOL.md "Proposed":** (1) `every`/`next`/`due` on
  routine, timer and reminder tasks, so the new Tasks page's Daily and Scheduled tabs fill in; (2) the
  "Describe your task" `send` with a `task {kind, date?}` hint: always -> watch item, daily -> routine,
  scheduled -> dated reminder any distance ahead; (3) `files_list` / `file_get` -> `files` / `file` for the
  owner's Files panel; (4) `style_list` / `style_add` / `style_remove` -> `style` for the "Your rules" screen;
  (5) `images` on `send` for pictures in chat; (6) optional `sources` on the final message; (7) document the
  `telemetry` fields in the admin snapshot.

- **Email alerts: done on the backend 2026-11-18** as `orion/mail_alerts.py`, following the plan below point by point
  (codes hashed with 15-minute expiry, 3 codes an hour, 5 wrong codes lock an hour; 3 emails per account per day and 10
  a day overall; quiet hours 22:00 to 07:00 held and sent at 07:00; bundling within 10 minutes; skipped while a device of
  that account is active; privacy redaction; plain text + HTML; `List-Unsubscribe` and a footer link to
  `https://<funnel>/u/<account>/<token>` on the UI port, which only turns alerts off; emails to Orion's address are never
  read as commands). Both senders are built: **Resend** (default, the EMAIL-SETUP.md plan: one HTTPS call per email, one
  recipient, 429/5xx retried once, `reply_to`) and SMTP through a Gmail made for ORION. The backend's names differ a
  little from EMAIL-SETUP.md's first draft and that file now says so: the key lives at
  `Orion-assistant / email_alerts:resend_api_key`, the sender in `config.json -> email_alerts {provider, from_address,
  display_name, reply_to}`, and the setup command is `orion_connect.py email-alerts` (`orion_connect.py email` is the
  owner's Gmail *reading* connector and stays as it is). **Landon:** follow EMAIL-SETUP.md, run `email-alerts`, restart
  Orion. Until then `email_set` answers with the "not set up" error above. The plan, for reference:
  1. **Sending: Resend (changed 2026-11-17, replaces the Gmail plan).** Landon is buying a domain for the web app,
     so ORION sends from it, e.g. `orion@alerts.<domain>`, display name "ORION", through Resend (free tier: 3,000 a
     month, 100 a day; expected volume about 50 a week). Setup steps for Landon are in EMAIL-SETUP.md. Backend:
     - API key in Credential Manager (`Orion-assistant / email_alerts:resend_api_key`); `from_address`, `reply_to` in
       `config.json -> email_alerts`; the site URL is `server.ui_url`. Never in this repo.
     - Send with one HTTPS call, `POST https://api.resend.com/emails` (Bearer key; `from`, `to`, `subject`, `text`,
       `html`, `headers` for `List-Unsubscribe`, `reply_to`). One recipient per email, never a shared To/CC. Retry
       429/5xx once with backoff; failures land in the admin snapshot (`email_alerts.last_error`), never the key.
     - `orion_connect.py email-alerts` prompts for the provider, the address and the key with hidden input, stores
       them, and sends a test.
     - Until the domain is verified, Resend's test sender (`onboarding@resend.dev`) only delivers to the Resend
       account's own address, so only the owner can be tested; guests start once DNS is verified.
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
  6. **Replies:** set `reply_to` to the owner's address (config) for now; ORION doesn't read incoming mail, and
     emails are never read as commands (anyone can forge a sender).
  7. **Tests:** code expiry and lockout, guest isolation (one account never triggers another's email), quiet hours,
     caps, unsubscribe link.

## 2026-11-18 evening: scheduled tasks, profile page, results in chat (backend session, both sides)

Landon asked for tasks to be the way ORION acts on his own, for guests to have the same, for guests to research (Brave)
and get email updates about their tasks and reminders, and for a profile page (sign out, what ORION knows, change the
title). Done on the backend and, to keep the two in step, **also in this repo by the backend session** (commits of
2026-11-18 evening): `js/profile.js` (new page, route `#/profile`, rail and drawer links), `js/leo-client.js`
(`profile` frames, `profileGet/Update/Forget`, `signOut()`, `account` event), `js/app.js` (Tasks page copy and rows for
`source: "Scheduled"` with status and result, remove buttons on scheduled tasks and reminders, the `background` message
kicker, the profile route), `index.html`, `css/app.css`, `sw.js` (v54), `js/tools.js` (planner description). Shapes in
ORION-PROTOCOL.md "Implemented on the backend 2026-11-18 (evening)". UI session: please keep these when you next touch
the Tasks page; the "Proposed" section is empty again.

Backend facts the UI relies on: `_task_hint` makes `run` routines for daily/scheduled kinds (reminders only on reminder
words); chat sentences that are clearly "do X at a time" are scheduled by code; tools `schedule_task`, `task_list`,
`task_remove` exist for every account; a due task becomes a background job for that account and its result arrives as
the task's `detail`, a `message {background: true, title}` and a `notify`; the heartbeat fetches live weather / quotes /
scores / headlines for watch items that need them (guests included); `profile_*` frames and `GET /profile`, `PUT /me`.

## Open: UI (this repo's session owns these)

- Done 2026-11-17: `js/tools.js` lists 11 bands; `files` skills are Read / Create; Shopify is marked read-only.
- Done 2026-11-17: the Files panel and "Your rules" are built in ORION's panel; the frames are live on the backend now.
- To check against the live backend (2026-11-18): task `source` values are `Routine`, `Reminder`, `Timer`, `Planner`
  (dated reminders), `Workflows`; dated-reminder ids start with `reminder_`; the echoed user `message` has `images`
  (saved names); `style` items carry `n` and a change reply carries `result`; `email_alerts` has `pending: true` while a
  code is out; the final `message` has `sources` only when pages were read; `admin_snapshot.telemetry_7d` and
  `admin_snapshot.email_alerts` exist. Shapes in ORION-PROTOCOL.md "Backend notes".
- **Audit (2026-11-18): `AUDIT-2026-11-18.md`** in this repo compares the backend with the UI at v51. UI items, in
  order: show `snapshot.opening`; a device token instead of the password kept in localStorage (needs a backend
  frame too; proposal welcome); a Background list for Jobs/Workflows tasks and banner targets; the email `pending`
  state after a reload; patch vitals instead of re-rendering the detail panel; the Daily tab's UTC sort; stale copy
  ("needs an update on ORION's side"); the mock client split out of the live bundle.
- New on the backend (night of 2026-11-18): background jobs. "In the background, research X" / "when you have a moment"
  / "no rush" is answered at once ("Queued as job 1: ...") and the work arrives later as a `task` `job_<id>` with
  `source: "Jobs"` (queued -> running -> done / rejected, `detail` = result), an activity line and a `notify` "Job done".
  Show it like a workflow task. Desktop actions now save before/after screenshots into `files/desktop/` (the `files`
  frame is re-sent after them). Pictures sent in chat are OCR'd first, so numbers in receipts and screenshots are exact.
- **UI to build (Landon's request, 2026-11-18): the conversation tab opens with `snapshot.opening.text` as Orion's
  first line instead of the fixed "Evening, Commander" greeting, and replaces it when an `opening` event arrives.**
  Shape and rules in ORION-PROTOCOL.md "Backend additions: opening". Backend done and live.
- Owner decisions still open from GUEST-PROFILES.md: Kyle's niche-market morning report (needs a guest routine or a
  line in his brief, plus research spend) and Blake's career notes (the people-card tools can hold them). The backend
  can add a per-guest brief line once Landon says yes.
- The Business page can keep its sample note until `metrics` arrives; nothing to change. When Shopify lands, the
  backend's `days` will start with Shopify history (orders/revenue for 60 days) but `sessions`/`studio`/`carts`/
  `checkouts` only from the day Clarity collection started, so early days may be zero there.
- Voice phase 2 (server audio): still undesigned on both sides.

## How each side tests against the other

- Backend: `tests/test_ui_bridge.py` on the PC (55 live checks) proves every frame above against the running server.
- UI: serve this repo on `localhost:8840` and open `?server=ws://localhost:8765&token=<owner token>` on the PC, or
  use the live Funnel address from anywhere with the login screen.
