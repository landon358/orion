# Orion architecture (backend, as of 2026-11-17)

One Python process on the owner's Windows PC does everything. Read this first, then the file you need.

**Where the code lives.** The backend is the folder `C:\Users\lando\orion` on Landon's PC (Python 3.12 in
`.venv`, FastAPI, Ollama). It is not in any git repository; git is not installed on that PC. The github.com/landon358/orion
repo holds only the web UI plus copies of this file and the hand-off docs (`CLAUDE.md`, `SYNC.md`, `ORION-PROTOCOL.md`,
`ACCOUNTS.md`, `GO-LIVE.md`). A Claude working in the UI repo cannot run or edit the backend; write what you need
into `SYNC.md` there and Landon's backend Claude applies it. A Claude working on the PC edits the backend directly
and pushes doc copies to the repo with the GitHub Contents API.

## Map of the documents

| Question | Read |
|---|---|
| How do I run it, what are the parts, what can it do | `README.md` |
| The HTTP API for scripts and tests | `API.md` |
| Why it is built this way (research on Claude Duet, Grok Bot, Muse, OpenClaw) | `ALWAYS-ON.md` |
| Orion's own account of itself, rules, working notes (it reads and edits this) | `brain/SELF.md` |
| The ORION UI wire protocol, base version | UI repo `ORION-PROTOCOL.md` (github.com/landon358/orion) |
| Accounts, watch lists, briefs, Local/Local+, the owner's master view, over the socket | UI repo `ACCOUNTS.md` |
| What UI edits must not break, and how to test against the real backend | UI repo `CLAUDE.md` |
| Moving the UI to Netlify with a login screen | UI repo `GO-LIVE.md` |
| What the backend added for the new UI and what the UI still has to build | UI repo `SYNC.md` |
| The running log of the capabilities plan: done, open, needs the owner | `OVERNIGHT.md` (backend only) |
| Copies of the UI-repo files | `ui-repo/` here |

## The process

```
orion_server.py  (FastAPI, 127.0.0.1:8766)         one Orion, one state
 ├─ orion/agent.py        Orion: sessions per account, routing, local + cloud turns, tool execution through the Guard
 ├─ orion/bridge.py       the ORION UI WebSocket (127.0.0.1:8765 root, and :8766/ws); Tailscale Funnel publishes it as wss://
 ├─ orion/routines.py     scheduled jobs (built-in actions in orion/actions.py, generic checks with change detection)
 ├─ orion/heartbeat.py    every 30 min: each account's checklist vs what Orion knows for that account
 ├─ orion/events.py       per-account event bus with persisted backlog (timers, routines, heartbeat, brief, inbox)
 ├─ orion/brain.py        the memory folder: facts, journal, reports, workflows, inbox, SELF.md, OWNER.md, STYLE.md, HEARTBEAT.md, guests/<id>/
 ├─ orion/text.py         reply hygiene (markdown stripped from every reply, streaming-safe) and tool-argument repair against schemas
 ├─ orion/telemetry.py    data/turns.sqlite: one row per turn (tier, tools, repairs, retries, escalations, withdrawals, tokens, cost,
 │                        latency); GET /telemetry, admin_snapshot.telemetry; the eval harness tests/run_evals.py scores against it
 ├─ orion/fastpath.py     S0: unambiguous requests answered by code with no model call (time, maths, timers, lists, coins, conversions, greetings)
 ├─ orion/understand.py   S1: one local JSON call for follow-ups/corrections/cue-less messages -> standalone query, intent, tool family
 ├─ orion/utils_tools.py  deterministic utilities: units (pint), currency, date maths (dateparser), time zones, random, counts, passwords
 ├─ orion/quickinfo.py    news headlines (Google News RSS), stock/index/crypto quotes (Yahoo Finance), scores and schedules (ESPN); no keys, cached
 ├─ orion/lists.py        named lists and to-dos as data, per account;   orion/sandbox.py   python_run: sandboxed Python for maths/data/charts
 ├─ orion/workflows.py    workflows as data (brain/workflows/*.json, Claude-written plans cached in data/workflow_plans.json); the runner
 │                        executes steps through Orion._exec_call with retries, skip/stop, caps, pause on confirmation, state in data/workflow_runs.json
 ├─ orion/people.py       people cards per account (people.json): relation, dated notes, last contact, saved facts; cards of people named in a
 │                        message ride into the speaker and cloud context; owner's cards seeded from the guest accounts (14 friends)
 ├─ orion/jobs.py         job queue: "in the background, ..." hand-offs queued by code, run one at a time as ordinary turns when the GPU is
 │                        free, results as `job` bus events (UI task job_<id>, banner, push, email); data/jobs.json
 ├─ orion/schedule.py     scheduled tasks (2026-11-18): parses "at 12pm" / "tomorrow at 9" / "every morning at 8" / "every 2 hours", reminder vs
 │                        work Orion does; a `run` routine queues the request as a job for that account when due (any account)
 ├─ orion/ocr.py          RapidOCR (CPU, local) reads the exact text of pictures and screenshots; it goes to the vision model and into the result
 ├─ orion/embed.py        memory by meaning: nomic-embed-text index per account (facts, notes, journals, profile files); recall into every reply
 ├─ orion/research.py     search -> fetch -> chunk -> rank -> the few passages that answer, with sources; cached a day
 ├─ orion/privacy.py      redaction of keys, tokens, card/account numbers before anything goes to Claude
 ├─ orion/metrics.py      the Business page `metrics` object from Shopify + Clarity (+ Meta); routine metrics_refresh, Bridge.set_metrics
 ├─ orion/push.py         phone push (ntfy or Twilio SMS), owner only: bus banners + approvals, skipped while an owner device is active
 ├─ orion/mail_alerts.py  email alerts for every account from ORION's own address (Resend on the web app's domain, or a Gmail made for ORION
 │                        over SMTP): verified addresses (6-digit codes), caps, quiet hours, bundling, unsubscribe links; state in data/users.json
 │                        + data/email_alerts_state.json; setup orion_connect.py email-alerts (UI repo EMAIL-SETUP.md)
 ├─ orion/users.py        accounts: owner + guests, tokens, passwords (PBKDF2), budgets, the own Local+ switch
 ├─ orion/safety.py       risk tiers READ/LOW/CONFIRM/CRITICAL, Guard, leases, approval rules, audit log
 ├─ orion/tools.py        core tools, which ones guests get, cue regexes that decide which tools the 9B is offered
 ├─ orion/integrations/   connectors (email, github, meta_ads, bambu, clarity, shopify [read-only], fusion360, desktop, browser,
 │                        files [read md/txt/csv/xlsx/pdf/docx/images, create text files and spreadsheets, sandboxed to allowed folders])
 ├─ orion/cloud.py        Anthropic client + weekly budget ledger;  orion/local.py  Ollama text/JSON calls
 └─ orion/voice.py, kokoro_server.py (:8880), orion/lang.py   speech in/out, EN/FR
orion_cli.py      terminal client;   orion_connect.py   setup: connectors, tokens, accounts, passwords, ui-url, ui-link
start-orion.ps1 / stop-orion.ps1 / install-autostart.ps1 / setup-tailscale.ps1 [-Public] / start-ui-local.ps1
```

## The turn pipeline (added 2026-11-17, see OVERNIGHT.md for the full log)

```
text -> S0 fastpath.match (code, ms)            time, maths, timers, coins, conversions, news, quotes, scores, greetings: tool via the Guard + templated reply
     -> S1 understand (only if needed, ~0.7 s)  follow-ups ("and tomorrow?"), corrections, cue-less sentences -> standalone query + tool family
     -> route (regex cues + Local/Local+)       local | haiku | sonnet; fresh-info web questions -> Haiku when Local+ is on
     -> local decider                           only the family's (or cue-matched) tools; args repaired; failed call -> retry note; 2 failures -> Haiku
        | or cloud turn                         privacy-redacted, prompt-cached, filtered research passages, images attached
     -> local speaker                           persona + clock + style rules + profile/SELF on topic + memory recall (embeddings) + capability card
     -> S6 checks                               no markdown/emoji, padding sentences dropped, INABILITY / FALSE_DONE -> retract and redo with Haiku,
                                                Sources line for web answers, taint gating of write tools, long results shelved (data#N)
     -> telemetry row                           data/turns.sqlite
```

## The main classes

| Class | File | Role |
|---|---|---|
| `Orion` | `agent.py` | the one agent: `chat()` runs a turn for the current session and yields events (`route`, `status`, `ack`, `tool_call`, `tool_result`, `delta`, `retract`, `confirm`, `done`); `route()` picks the tier; `_exec_call()` runs a tool through the Guard; `cloud_status()` is the Local/Local+ truth; `capability_card()` lists what it can do from the live registry |
| `Session` | `agent.py` | one per account: history, `Brain`, `Guard`, shelved data, taint flag; `Orion.current` points at the active one |
| `Registry`, `Integration`, `ToolSpec` | `integrations/__init__.py` | loads connectors that have credentials, exposes their tools; a `ToolSpec` is name, description, handler, risk, JSON params |
| `Toolbox` | `tools.py` | the core tools (memory, timers, lists, utilities, research, style, files export, routines, watch lists) and `GUEST_TOOLS` |
| `Guard`, `Rules`, `Risk` | `safety.py` | risk tiers, confirmations (`Pending`), remembered decisions, audit log |
| `Brain` | `brain.py` | the memory folder for an account; `vindex` is its `MemoryIndex` (`embed.py`) |
| `Users`, `User` | `users.py` | owner and guests, tokens, passwords, budgets, each account's cloud switch |
| `Bridge`, `Room`, `Client`, `Limiter` | `bridge.py` | the UI socket; one `Room` per account; `_run` turns agent events into frames; `admin_snapshot` |
| `Bus` | `events.py` | per-account events with backlog (timers, routines, heartbeat, brief, inbox) |
| `Routines`, `Actions`, `Heartbeat` | `routines.py`, `actions.py`, `heartbeat.py` | the always-on layer; both wait for `Orion.wait_idle()` so live turns keep the GPU |
| `CloudClient`, `Budget` | `cloud.py` | Anthropic calls with prompt caching; weekly and per-day spend ledger (`data/spend.json`) |
| `Telemetry` | `telemetry.py` | `data/turns.sqlite` |
| `Tidy` | `text.py` | streaming markdown stripper used on every reply |

## What is on disk

```
config.json          everything non-secret: models, local ctx measurements, integrations (enabled flags, roots), routines, safety flags, server origins
data/                settings.json (cloud_master), users.json, spend.json, routines.json, events.json, audit.jsonl, turns.sqlite, briefs.json, lists.json
brain/               the owner's memory: SELF.md, OWNER.md, STYLE.md, HEARTBEAT.md, facts.json, memory.sqlite (embeddings), journal/, notes/,
                     reports/, workflows/, proposals/, inbox.json, .history/ backups, guests/<id>/ (one folder per guest, same shape)
files/               the Files connector workspace (default root for file_write, sheet_create, export_chat, python_run output)
Modelfile            the local persona (system prompt + sampling); `ollama create orion -f Modelfile` after editing
tests/evals/         JSONL behaviour suites and results/ baselines
```

Secrets (API keys, tokens, app passwords) are only in Windows Credential Manager under the service `Orion-assistant`,
written by `orion_connect.py`; nothing in these folders holds one.

## Three brains and the Local / Local+ switch

1. Local 9B (Ollama tag `orion`, qwen3.5 9B, 12k context, free): chat, commands, memory lookups, heartbeat,
   local routine judgements, guest briefs. Two calls per turn: a persona-free decider picks tools, the persona
   speaker writes the reply.
2. Claude Haiku 5.5: research, drafting, analysis, triage, the owner's morning brief.
3. Claude Sonnet 5.5: deep dives, owner only.

**Attempt first (added 2026-11-16).** Three guards against the 9B talking itself out of a job: (1) a connector's tools
are offered when the request matches its keywords, and `_execute` repairs the model's arguments against the tool
schema (`text.normalize_args`: unknown names dropped, a stray value moved into the missing required slot, types
and enums coerced); (2) if the request names a connected connector and looks like work (`TASKISH`) but the decider
called nothing, the turn goes to Haiku; (3) if the local reply matches `INABILITY` ("I cannot", "tool failed",
"my scope") with no tool used, the agent yields `retract` and Haiku redoes the turn (the bridge resets the message
text under the same id). Both (2) and (3) need Local+ on. `text.Tidy` strips bold/italic/heading/star-bullet
markdown from every streamed reply, local or cloud, leaving arithmetic such as `17*23` alone.

`Orion.route()` is rule-based (regex cues), no model call. Before any cloud tier it consults
`Orion.cloud_status(user)`, the single source of truth for **Local / Local+**: master switch
(`data/settings.json` `cloud_master`, owner only) AND the account's own switch (`User.cloud`) AND budget
(weekly for the owner, lifetime allowance for a guest, 10 cents default). If any is off the turn is local and
the reason is reported. Surfaces: UI frames `cloud` / `cloud_master`, HTTP `/cloud`, `/cloud/master`, CLI `/cloud`.

## Accounts

- **Owner**: everything. Token in Credential Manager (`Orion-assistant / server:api_token`), optional login
  password (`orion_connect.py password`), login name (`name owner "..."`).
- **Guest** (a friend): `orion_connect.py guest add "Name" --password` or the UI's `account_add`. Chat, research
  (Brave-backed), news/quotes/scores, calculate, weather, timers, reminders, scheduled tasks Orion carries out for them
  (2026-11-18), own facts, own watch list (with live checks), own brief, own profile page, four bands, 10-cent allowance then local.
  Enforced in three layers: tools outside `GUEST_TOOLS` are never offered, `Orion._exec_call` blocks them, HTTP
  returns 403. Guest tools only touch the guest's own data, so they run as READ risk. Guests never see owner data,
  SELF.md beyond its identity section, other accounts, or any way to change Orion.
- One **Session** per account (history, Brain, Guard). Brain for a guest lives in `brain/guests/<id>/`.
- Login over the socket: `hello {name, password}` or `{token}`; 5 failures per address lock it for 10 minutes.

## What runs on its own

- **Routines** (`config.json` + `data/routines.json`): interval or clock triggers; built-ins email_triage,
  printer_watch, clarity_daily, morning_brief; generic checks hash a snapshot and only call a model on change.
  Never create confirmations; anything learned goes to `brain/inbox.json` for the owner. Every routine carries `user`
  (default owner); `Routines.for_user` / `summary(user_id)` give an account its own.
- **Scheduled tasks** (`orion/schedule.py`, action `run` in `actions.py`, added 2026-11-18 at the owner's request): a
  routine with `action: "run"` and `text` is Orion doing the request itself when due: `Actions.run` queues the text as a
  background job for the routine's account (`Jobs.submit(..., routine=name)`), which runs as an ordinary turn with that
  account's tools and budget; the job's status and result show on the task (`Bridge.sync_tasks`, ids `sched_<name>` /
  `routine_<name>`, source "Scheduled"), in the conversation (`message {background, title}`), as a banner and by email.
  Owner and guests alike (guests: `run` and `reminder` actions only, 10 at most, removed with the account). Created by
  `Orion._task_hint` (the Tasks page: daily/scheduled kinds are work unless the words ask for a reminder), by
  `Orion._schedule_hit` (chat sentences that are clearly "do X at a time", listing and removing by code) and by the tools
  `schedule_task` / `task_list` / `task_remove` (every account; `remind_at` is described as "only for what the person does").
  Before this every scheduled request became a reminder and a guest's daily task fell back to the watch list.
- **Heartbeat** (`Heartbeat.run_all`): per account. Owner's `brain/HEARTBEAT.md` against everything; a guest's
  own checklist against their timers, notifications, scheduled tasks and last conversation. Alerts to that account only,
  deduped 24 h, empty list = no model call. Items come from chat (`watch_add`) or the UI (`watch_add` frame).
  Live checks (2026-11-18): a checklist line about the weather, a stock or crypto price, a team or the news gets a free
  live snapshot (`Heartbeat.live_checks`: open-meteo, Yahoo Finance, ESPN, Google News via quickinfo) appended to the
  context before the judge runs, so "tell me if NVIDIA drops below 180" can actually fire; at most 4 lines per run.
  Code first (2026-11-17): `code_checks` decides what code can (printer paused/failed, routine in error, inbox over
  a count, budget nearly spent) and `fingerprint` hashes the context minus clock noise; the model runs only when the
  fingerprint changed (or a clock-dependent line exists and the hour moved). Log rows carry `mode`: skipped / code / model.
- **Briefs**: owner = morning brief at 07:30 (Haiku, connectors, CIEL). Guest = free local "while you were away"
  on connect, cached 6 h (`data/briefs.json`).
- **Workflows** (`orion/workflows.py`, added 2026-11-17): a plan is steps `{tool, args, say, on_fail}` with `{{param}}`,
  `{{stepN}}` and `{{prev}}` templates. `workflow_run` (owner only) finds a saved plan by name, else a cached plan for the
  normalised goal, else asks Haiku once for a plan (validated against the live tool list, cached). `Workflows.execute`
  runs the steps through `Orion._exec_call` (so each step is guarded, audited and shown as a tool call), retries a failed
  step twice, stops or skips per step, caps at 12 steps / 10 minutes, yields `task` events (`wf_<run>`, source
  Workflows) and pauses when a step needs confirmation; the owner's yes resumes it (`after_confirm`, hooked in `_chat`).
  Runs persist in `data/workflow_runs.json`; `workflow_resume` continues a paused or stopped run.
- **Job queue** (`orion/jobs.py`, added 2026-11-18): a request carrying a hand-off phrase (`JOB_CUES`: "in the background",
  "when you have a moment", "no rush", "queue this") is answered at once by code ("Queued as job 3: ...") and run later by
  one worker thread as an ordinary `Orion.chat` turn for that account (same tools, same limits), after `wait_idle` so a
  live turn keeps the GPU. While `Orion.job_running` is set, `_exec_call` treats CONFIRM tools as it does for routines
  (refused: nobody is there to say yes) and no job can queue another. Results go on the bus as `job` events (queued,
  running, done, failed): the bridge shows a task `job_<id>` (source Jobs), an activity line and a banner; push and email
  carry done/failed; the "while you were away" opening lists them. `job_list` / `job_cancel` by code (`JOB_STATUS`,
  `JOB_CANCEL`), `job_start` also offered to the models. Jobs queued when Orion stops are marked lost, never re-run.
- **OCR cross-check** (`orion/ocr.py`, added 2026-11-18): every picture read (`file_read`, chat `images`, `desktop_look`)
  is first passed through RapidOCR; the exact text is given to the local vision model ("use these words and numbers as
  they are") and appended to the tool result ("Text in the picture, read exactly by OCR"), so totals, order numbers and
  names come from characters, not from the 9B's guess. Under a second per image, nothing leaves the PC, never raises.
- **Desktop safety screenshots** (`orion/integrations/desktop.py`, added 2026-11-18): `desktop_click`, `desktop_type`
  and `desktop_keys` are framed by two screenshots saved to `files/desktop/<time>-<action>-before|after.jpg` (newest 40
  kept); the tool result names them and the UI Files panel refreshes, so the owner can see what Orion did.
- **Confirmations** (`orion/safety.py` `is_yes`, 2026-11-18): while an action waits, "yes send it", "ok go ahead and
  send", "send it", "oui envoie" count as yes (a yes-lead or the action's own verb, at most a few words, none of them a
  change request such as "but", "instead", "cc", "?"); a change request still cancels the pending action and is treated
  as a new request. And when a turn ends with an action waiting, the reply must ask: if the model's text claims the deed
  was done or does not ask yes/no, code replaces it with "Not done yet, Commander. Waiting for your OK to ... Say yes to
  proceed or no to cancel." (This fixed the sonnet email of 2026-11-17 that Orion said it had sent: "yes send it" was
  not a strict yes, the pending send expired as a new request, and the 9B then wrote "sent" for a NOT DONE YET result.)
  A yes or no that arrives after the offer has expired (`safety.confirm_timeout_s`, 2 minutes; audited as `expired`) is
  also answered by code: "Nothing was waiting for your OK, Commander. The request expired after 2 minutes, so nothing
  was done. Ask again if you still want it." (Found 2026-11-18 when the 9B answered such a yes with "I have forgotten
  that fact" while the fact was still there.)
- **Phone push** (`orion/push.py`, added 2026-11-17): the owner's bus events (reminders and other notifications,
  heartbeat alerts, routine results, the brief) and approvals are mirrored to a phone through ntfy (free app, a topic
  name) or Twilio SMS. `Bridge.seconds_since_owner_frame` tells it whether an owner device is active; if one sent a
  frame in the last `only_when_away_s` (120 s) the banner is enough and nothing is pushed. Quiet hours (23 to 7) hold
  everything except approvals; 10-minute dedupe; `max_per_hour`. Setup `orion_connect.py push ntfy <topic>` or
  `push twilio`; `test push`. Guests never trigger a push.
- **Memory**: facts auto-extracted at journal time (idle 15 min or shutdown); rolling notes when history exceeds
  the window; `memory_search/list/read` tools; owner-only `memory_write` with backups in `brain/.history/`;
  Orion keeps `brain/SELF.md` current and writes `brain/proposals/*.md` for code changes it cannot make.
  `forget` (CONFIRM) and its preview use `Brain.matches`: every meaningful word of the phrase must occur at a word
  start in the fact (all but one when there are three or more) and function words such as "for" never count, so a
  forget can only reach the facts the phrase names (fixed 2026-11-18; before, any word matched as a substring).
- **Knowing the owner**: `brain/OWNER.md` (profile: CIEL, friends, tools, preferences) is injected into the local
  speaker on `OWNER_Q` questions and into every owner cloud turn; guests never get it (`Brain.owner_text`).
- **People cards** (`orion/people.py`, added 2026-11-17): tools `person_note` (dated note, creates the card, a contact verb
  sets last contact), `person_card`, `people_list`, offered on `PEOPLE_CUES` or when a known first name appears. `People.mentioned`
  matches a full name or a unique first name (the two Evans are never guessed); `cards_for` is injected into `_local_speaker` and
  `_cloud_context` whenever a message names someone on file. Facts saved with `remember` that name the person show on the card.
- **Style rules**: `STYLE.md` per account (`Brain.style_items/add/remove`, tools `style_add/list/remove`, offered on
  `STYLE_CUES`); injected into every local speaker call and cloud context. A message that is itself an instruction
  (`STYLE_CMD`: "from now on…", "stop/never/always + verb…") is saved even when the decider did not call the tool.

## Files (orion/integrations/files.py, added 2026-11-16)

Owner only, no secrets, always loaded. Roots from `integrations.files.roots` (defaults: `<orion>/files` workspace,
Documents, Desktop, Downloads, Pictures); `_resolve` maps what the owner typed to a path inside them, relative
paths land in the workspace. Tools: `file_list`, `file_find`, `file_read` (text, sheets, pdf, docx, images),
`sheet_read` (per sheet: columns, first rows, numeric stats via `describe_rows`), `file_write` (text formats;
replacing an existing file is CONFIRM via `risk_fn`), `sheet_create` / `sheet_append` (openpyxl, rows as JSON or
CSV text, `parse_rows`), `file_open`. Images: the local qwen3.5 model has vision, so `file_read` on a picture
returns a free description; the result starts with `@@image:<path>@@`, which `Orion._execute` strips and
`_cloud_turn` turns into an image block so Claude sees the picture itself. `export_chat` (core tool, owner) writes
the recent conversation to the workspace. HTTP: `GET /files`, `GET /files/download?path=` (owner).

## The UI bridge (orion/bridge.py)

Rooms per account; every device of an account shares state, approvals and activity; chat messages are shown only
on the device that sent them (`server.ui_shared_chat` flips that). Orion events map to protocol frames
(`route/status` → `state`, `tool_call/result` → `tool` + `activity`, `delta` → streamed `message`, `confirm` →
`approval` + `task` + `notify`). Bus events become `activity`/`notify`/`task`/`brief`. Owner devices can turn on
`admin` and receive `admin_snapshot` plus a live `admin_event` mirror of every room. `vitals` once a second from
nvidia-smi. `speaks: false` (the browser speaks; Kokoro over the socket is phase 2, not designed).

Added 2026-11-18 for the UI's Tasks page, panel and email pop-up (shapes in the UI repo's ORION-PROTOCOL.md "Implemented
on the backend"): `sync_tasks` (one task per routine with `every`/`next`, per dated reminder and timer with `due`, re-sent
after task-changing tools and when a timer finishes); the `send.task` hint handled by `Orion._task_hint` (code, no model);
`style_*` -> `style`; `files_list`/`file_get` -> `files`/`file` (workspace only, owner); `send.images` saved under
`files/chat/` and looked at by the local vision model before the turn (`image_look`); `sources` on the final message;
`email_*` -> `email_alerts` through `orion/mail_alerts.py`, with `/u/{account}/{token}` on the UI port as the one-click
unsubscribe; `telemetry_7d` and `email_alerts` in the admin snapshot. Evening of 2026-11-18: `profile_get` /
`profile_update {address}` / `profile_forget {text|n}` -> `profile` (`Bridge.profile`: account, title, facts, counts, email
alerts, cloud status, the owner's note about a guest; `Users.set_address` validates; `_user_changed` refreshes the room and
the live `Session.user`), `account.features.tasks/profile`, `sync_tasks` per account with "Scheduled" tasks following their
job, `_relay_one` turning a finished job into the task's `detail`, a `message {background: true, title}` and a banner. The UI
repo's `js/profile.js`, Tasks page and client were updated by the backend session the same evening. Guests get `PROFILE.md` (from the UI repo's
GUEST-PROFILES.md) injected into their own turns only (`Brain.profile_text`). `snapshot.opening` / `opening` event
(owner's request): the chat box's first line is the account's "while you were away" summary (`Bridge.openings`, local
model, kept current by `_brief_loop` while the person is away) or a code greeting until one exists; the owner's `briefs`
entry stays the morning brief for the home card and the `brief {}` command.

## Safety

READ and LOW run; CONFIRM waits for a strict yes; CRITICAL blocked unless enabled in `config.json → safety` and
still asks. Owner may remember a decision ("24h"/"always", never CRITICAL, never guests). Tool output is wrapped
as untrusted data. Everything logged to `data/audit.jsonl` with the account id. Safe mode = read-only.

## Tests (run from the orion folder with `.venv\Scripts\python.exe`)

| File | Needs | Covers |
|---|---|---|
| `tests/test_units.py` | nothing | Guard, rules, Brain, memory_write, watch lists, style rules, owner profile, Tidy, normalize_args, Clarity compact, passwords, limiter |
| `tests/test_hybrid.py` | nothing | routing, tool schemas per role, SELF_Q/OWNER_Q/INABILITY/TASKISH/STYLE_CMD cues, capabilities |
| `tests/test_orion.py` | nothing (model faked) | accounts, bus, routines, per-account heartbeat, Local/Local+, guest tool gating |
| `tests/test_ui_bridge.py` | Orion running | the whole socket contract incl. accounts, watch, brief, admin, cloud switches |
| `tests/test_server.py` | Orion running, ~1 cent | HTTP API |
| `tests/run_evals.py` | nothing (`--live` needs Ollama) | behaviour scores per suite (routing, tools, style, self, grounding, followups, understand); baselines in `tests/evals/results/` |

## Rules for changing the backend

1. Guests must never gain actions, connectors, owner data or any way to change Orion; add new tools to
   `GUEST_TOOLS` only if they touch nothing but the guest's own data.
2. Secrets only in Credential Manager; never in config, memory, logs or the repo.
3. Any change to what the bridge sends or expects must be mirrored in the UI repo's `CLAUDE.md`/`ACCOUNTS.md`
   (copies in `ui-repo/`; push with the GitHub Contents API, git is not installed here).
4. Model tests use a temp `brain_dir`; keep API spend in tests tiny.
5. Restart with `stop-orion.ps1` then `start-orion.ps1` after code changes; Leo (C:\Users\lando\leo) must stay
   stopped, both cannot share the GPU.
