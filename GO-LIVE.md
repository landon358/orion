# GO-LIVE.md: from "repo on GitHub Pages" to "type the address, enter the password, use Orion"

Target: anyone on any device opens `https://<site>.netlify.app`, sees a lock screen, types the
password once, and talks to Orion. No app installs, no tokens in links. Strangers who find the
address see the lock screen and nothing else, because the page itself contains nothing private and
Orion's server refuses every connection that does not present the password or a token.

The backend side of this is done and live (see CLAUDE.md). This file is the checklist for the UI
polish and the Netlify move, in order.

## 1. UI changes to make during the polish (the only backend-facing ones)

Everything else about the look is free to change. These three keep it working with the backend.

### 1a. A default server address

Add `js/config.js`:

```js
// Where Orion's server is. Empty = demo mode unless ?server= is given.
export const DEFAULT_SERVER = 'wss://<pc-name>.<tailnet>.ts.net';
```

`<pc-name>.<tailnet>.ts.net` is printed by `setup-tailscale.ps1 -Public` on the PC (or
`orion_connect.py ui-link`). It never changes once Funnel is on, so it is safe to commit; it is a public
hostname, not a secret.

In `createLeoClient()` in `js/leo-client.js`: when nothing is stored in localStorage and no `?server=`
was given, use `DEFAULT_SERVER` with an empty token. Keep the `?server=&token=` override and `?demo`
exactly as they are.

### 1b. A login screen (name + password) instead of a token in the link

When the client has a server but no stored login (or the server closed with **4401**), show a
full-screen login view after the opening animation: the ORION wordmark, a name field, a password
field, a Connect button, and an error line. On submit, send
`hello {name, password, client, protocol}` and, once the `snapshot` arrives, store `{url, name, password}`
under the existing `orion-server` localStorage key so the next visit logs in silently. The full
account model (what each account gets, watch list, brief, the owner's admin view) is in **ACCOUNTS.md**.

- 4401 means wrong name or password, or too many attempts (the address is locked for 10 minutes after
  5 failures). Show "Wrong name or password", clear the stored login, return to the login screen.
- A `?token=` in the link still works and skips the login screen.
- Never put the password in the URL.

### 1c. Keep what CLAUDE.md lists

Frame types, field names, 4401 handling, reconnect backoff, per-device message display. Bump
`VERSION` in `sw.js` before deploying so installed copies refresh.

## 2. Netlify (once, 10 minutes)

1. https://app.netlify.com -> Add new site -> Import an existing project -> GitHub -> `landon358/orion`.
   `netlify.toml` already sets the publish folder; leave build command empty. Deploy.
2. Site configuration -> Change site name, e.g. `orion-ui` -> address `https://orion-ui.netlify.app`.
   A custom domain works the same way; use whatever address you will type.
3. Every push to `main` redeploys. GitHub Pages can stay on or be switched off in the repo settings; the
   backend will allow both origins if you leave it.
4. Optional extra layer: Netlify's site-wide password (Site configuration -> Access & security ->
   Site protection) hides even the lock screen, but it is a paid-plan feature. Orion's own password is
   what actually protects Orion; the Netlify one only protects the HTML.

## 3. On the PC (once, 5 minutes)

In PowerShell, in `C:\Users\lando\orion`:

```
.venv\Scripts\python.exe orion_connect.py password            # the owner's login password (12+ chars)
.venv\Scripts\python.exe orion_connect.py name owner "Landon"  # the owner's login name (default "Owner")
.venv\Scripts\python.exe orion_connect.py ui-url https://orion-ui.netlify.app
powershell -File stop-orion.ps1
powershell -File start-orion.ps1
```

If Funnel is not on yet: `powershell -File setup-tailscale.ps1 -Public` (see the chat notes; MagicDNS and
HTTPS certificates must be enabled in the Tailscale admin console, and Funnel approved once).
`install-autostart.ps1` once, so Orion starts at login.

## 4. Check it

1. Open `https://orion-ui.netlify.app` on the PC: lock screen, password, connected, ten bands.
2. Same on a phone over mobile data (not the home Wi-Fi), to prove the public path. Add to Home Screen.
3. Type a wrong password five times on purpose from one device: the sixth attempt is refused for ten
   minutes. That is the brute-force guard working.
4. On the PC, `data\audit.jsonl` and the UI's activity feed show what Orion did.

## 5. Friends' accounts

`orion_connect.py guest add "Alex" --password` creates an account with a login name and password (or
use the master UI's "add account"). They open the same address and log in. They get chat, research,
timers, their own memory, watch list and brief, and a 10-cent cloud allowance; they cannot touch the
PC, connectors, settings, Orion's own files or your data. `orion_connect.py guest remove <id>`
revokes it. Details in ACCOUNTS.md.

## 6. What protects Orion, in one place

| Layer | What it stops |
|---|---|
| Netlify page is static | nothing private in the HTML; a visitor sees the lock screen only |
| Origin check | only the Netlify (and GitHub Pages / localhost) origins may open the socket; HTTP 403 otherwise |
| hello within 5 s with password or token | anything else is closed with 4401 |
| PBKDF2 password hash in Credential Manager | the PC never stores the password itself |
| 5 failures -> 10-minute lockout per address | guessing is not practical |
| Owner token 256-bit, constant-time compare | the link form stays safe |
| Orion's safety layer | even the owner's UI cannot do CONFIRM/CRITICAL actions without a yes; guests cannot act at all |
| Audit log | every action with user id |

To take Orion off the internet at any time: `& "C:\Program Files\Tailscale\tailscale.exe" funnel --bg off`.
