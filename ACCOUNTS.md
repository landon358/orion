# ACCOUNTS.md: wiring the login, per-account experience and the owner's master view

The backend already does all of this (Orion's `orion/bridge.py`, live and tested in
`tests/test_ui_bridge.py` on the PC). This file is what the UI has to send and show. Everything is
an addition to ORION-PROTOCOL.md: same `{"type", "data"}` frames, same socket, protocol stays 1.
Unknown frame types are ignored on both sides, so building this incrementally is safe.

## 1. The model

| | Owner (Landon) | Everyone else (a "guest" account) |
|---|---|---|
| Login | name + password, or the token link | name + password (or a token link the owner made) |
| Orion | full: actions on the PC, connectors, approvals, memory editing, self-refinement, routines | chat only: talk, research, calculate, weather, timers, their own facts, their own watch list. Cannot touch the PC, connectors, settings, Orion's own files, or any other account's data |
| Cloud budget | shared weekly budget | **10 cents** lifetime (`guests.budget_usd`), then the free local brain keeps answering |
| Heartbeat | `brain/HEARTBEAT.md` + everything Orion knows (printer, email, Clarity, routines, inbox) | their own checklist, checked with only their own context (timers, their notifications, their last conversation); alerts go to them only |
| Brief | the morning brief (07:30 routine, Haiku, CIEL data) | a free local "while you were away" summary of their timers, watch list, alerts and last conversation |
| Bands on the disc | all 10 | `memory, planner, web, voice` |
| Sees other accounts | yes, through the admin view | never |

Everything CIEL (Clarity, Meta Ads, Shopify when connected, the business page) is owner-only and never
appears in a guest room.

## 2. Login: the `hello` frame

```json
{"type": "hello", "data": {"name": "Alex", "password": "…", "client": "orion-ui", "protocol": 1}}
```

- `name` is case-insensitive; names are unique per account. The owner logs in the same way with their
  account name (default "Owner"; `orion_connect.py name owner "Landon"` changes it).
- `{"token": "…"}` still works (owner token, guest token, or the owner's password alone in the token field).
- Wrong name or password: close code **4401**. Five failures from one address: 4401 for ten minutes.
  The UI should show "Wrong name or password" and return to the login screen; do not retry automatically.
- Store `{url, name, password}` (or `{url, token}`) in localStorage under `orion-server` after a
  successful snapshot, so the next visit logs in silently. On 4401, clear it.

## 3. What the `snapshot` now carries

```json
{"protocol": 1, "speaks": false, "state": …, "tools": […], "tasks": […], "approvals": […],
 "activity": […], "vitals": …,
 "account": {"id": "g_1a2b3c4d", "name": "Alex", "role": "guest", "address": "Commander",
             "allowance_left_usd": 0.1,
             "features": {"actions": false, "connectors": false, "admin": false, "watch": true, "brief": true, "memory": true}},
 "watch": {"items": [{"id": "w1", "n": 1, "text": "Tell me if it rains tomorrow"}], "every_minutes": 30},
 "brief": {"text": "…", "at": 1763300000000, "fresh": true}}
```

- **Build the UI from `account.features`.** `admin: true` only for the owner; hide the approvals bell,
  the business page, routines and anything about connectors when `actions` is false.
- `tools` for a guest is the four bands; do not pad it to eight.
- `brief` is present only when a cached one is fresh (under 6 h). Otherwise it arrives as a `brief`
  event a few seconds after connect (guests: generated locally; owner: today's morning brief if it exists).
- `metrics` never appears for a guest.

## 4. Watch list (the per-account heartbeat checklist)

| Direction | Frame | Notes |
|---|---|---|
| UI → | `watch_add {text}` | one sentence, e.g. "Tell me if my tea timer finishes" |
| UI → | `watch_remove {n}` or `{id}` | `n` from the list (1-based) or the `id` ("w2") |
| UI → | `watch_list {}` | ask for the current list |
| ← UI | `watch {items: [{id, n, text}], every_minutes, result?}` | after every change, including changes made in chat ("keep an eye on…"); `result` is Orion's one-line confirmation or refusal |
| ← UI | `notify {title: "Heartbeat", body}` + `activity {kind: "think", title: "Heartbeat", detail}` | when a condition on the list is true, at most every `every_minutes`, same alert not repeated for 24 h |

Suggested UI: a "Watching" panel with the items, an add box, and the heartbeat alerts in the feed.
Both the chat ("let me know if…") and the panel edit the same list. Limit is 25 items.

## 5. Brief

| Direction | Frame | Notes |
|---|---|---|
| UI → | `brief {}` | ask for the account's brief now; at most one generation per 10 minutes, otherwise the cached one comes back with `fresh: false` |
| ← UI | `brief {text, at, fresh}` | show as the "while you were gone" card on the home page |

The owner's brief is the morning brief (also sent as a `brief` event when the 07:30 routine runs). The
`brief` command for the owner generates one only if today's does not exist yet (one Haiku call, about a cent).

## 6. Owner only: the master view and account management

All of these answer `error {message: "owner only"}` for anyone else.

| Direction | Frame | Notes |
|---|---|---|
| UI → | `admin {on: true}` | this device becomes an admin viewer; `on: false` stops it |
| ← UI | `admin_snapshot {accounts, rooms, audit, budget, routines, heartbeat, integrations, safe_mode, at}` | once, on `admin on`. `accounts`: every account with `online`, `state`, `watch_items`, `facts`, `pending_approvals`, `allowance_left_usd`, `last_seen`. `rooms`: per account id `{name, role, online, state, activity[≤50], approvals, tasks, watch, brief}`. `audit`: last 50 actions `{ts, user, tool, risk, outcome}` |
| ← UI | `admin_event {user, name, role, type, data, at}` | **every frame every room receives**, live: `message` (both roles, including guests' chats), `state`, `tool`, `activity`, `task`, `approval`, `notify`, `watch`, `brief`. `vitals` is not mirrored. Render it as a per-account activity wall; the inner `type`/`data` are exactly the normal frames |
| UI → | `account_add {name, password?, budget_usd?, address?, notes?}` | creates a guest; password 8+ chars. Reply: `accounts {accounts, created: {user, token}}` (the token is shown once; the name+password is the normal login) |
| UI → | `account_update {id, name?, password?, budget_usd?, address?}` | `password: ""` removes it. Reply: `accounts {accounts}` |
| UI → | `account_remove {id}` | closes their sockets with 4401, deletes the account (their memory folder stays on disk). Reply: `accounts {accounts, removed}` |
| UI → | `account_list {}` | reply: `accounts {accounts}` |

Suggested master UI: a left column of accounts (online dot, state, allowance left, watch items), the
selected account's live wall in the middle (from `admin_event`), audit and budget on the right, and an
"add account" form. Note for your friends: the owner can see their activity; say so when you give them
a login.

The same management exists over HTTP for scripts: `POST /users` (now takes `password`),
`PUT /users/{id}` (`name`, `password`, `budget_usd`, `address`), `DELETE /users/{id}`, `GET /watch`,
`GET /heartbeat` (per account).

## 7. On the PC (owner's side)

```
.venv\Scripts\python.exe orion_connect.py password                  # the owner's login password
.venv\Scripts\python.exe orion_connect.py name owner "Landon"       # the owner's login name (optional)
.venv\Scripts\python.exe orion_connect.py guest add "Alex" --password   # a friend, 10 cents, prompts for their password
.venv\Scripts\python.exe orion_connect.py passwd g_1a2b3c4d          # change a friend's password
.venv\Scripts\python.exe orion_connect.py guest list
```

Passwords take effect immediately; no restart needed. Budgets: `config.json → guests.budget_usd`
(default 0.10) for new accounts, `account_update` or `PUT /users/{id}` for existing ones.
