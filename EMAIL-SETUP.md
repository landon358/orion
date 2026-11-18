# EMAIL-SETUP.md: ORION's email through Resend

ORION sends email alerts from your own domain (the one that will serve the web app) through Resend.
The backend side is built (`orion/mail_alerts.py` on the PC; plan and status in SYNC.md under "Email alerts").
**No secrets go in this file or in the repo.**

## 1. Make a Resend account (5 minutes)

1. Sign up at resend.com with your own email. The free plan covers 3,000 emails a month and 100 a day. ORION
   expects about 50 a week.
2. Turn on two-factor sign-in in the account settings.

## 2. Add your domain (once you've bought it)

1. In Resend, open **Domains** → **Add domain**. Use a subdomain just for alerts, for example
   `alerts.yourdomain.com`. That keeps your main domain's email reputation separate.
2. Resend shows a few DNS records: a TXT record for SPF, a TXT record for DKIM (`resend._domainkey…`) and an MX
   record. Add each one exactly as shown at the place you bought the domain (its DNS settings page).
3. Also add a DMARC record on the main domain if there isn't one:
   `_dmarc` TXT `v=DMARC1; p=none;`
4. Back in Resend, press **Verify**. It usually turns green within minutes, though DNS can take up to a day.

Until the domain is verified, Resend only delivers to your own Resend email, so only your account can be tested.

## 3. Make an API key

1. In Resend, open **API Keys** → **Create API key**.
2. Name it `ORION PC`, set permission to **Sending access**, and limit it to your alerts domain.
3. Resend shows the key **once** (it starts with `re_`). Keep the page open for step 4. Don't paste it into chat,
   a file or the repo.

## 4. Store the key and the sender on the PC (one command)

On the Windows PC that runs ORION, in the ORION folder:

```powershell
.\.venv\Scripts\python.exe orion_connect.py email-alerts
```

It asks for the provider (`resend`), the sending address (`orion@alerts.yourdomain.com`), a reply-to address (your own)
and the API key with hidden typing. It stores the key in Windows Credential Manager as `Orion-assistant /
email_alerts:resend_api_key`, writes the sender into `config.json -> email_alerts` and offers to send a test email.
(`orion_connect.py email`, without `-alerts`, is a different thing: the owner's Gmail reading connector.)

What lands in `config.json` (no secrets):

```json
"email_alerts": {
  "provider": "resend",
  "from_address": "orion@alerts.yourdomain.com",
  "display_name": "ORION",
  "reply_to": "your own email",
  "per_account_per_day": 3, "per_day": 10, "quiet_hours": [22, 7], "bundle_s": 600, "only_when_away_s": 120
}
```

The "Open ORION" link in each email is `server.ui_url` from the same file (`orion_connect.py ui-url <url>` sets it).

## 5. Test it

1. Restart ORION (`stop-orion.ps1`, then `start-orion.ps1`).
2. In the web UI, open the envelope in the top bar, enter your own email and confirm the 6-digit code.
3. The code email should arrive from "ORION". If it lands in spam, mark it **Not spam** once. Resend's
   **Emails** page shows every send and whether it was delivered.
4. From the PC, `orion_connect.py test email-alerts you@example.com` sends a plain test at any time.

## Good to know

- **Limits:** the free plan is 100 a day. ORION's own caps (3 per account a day, 10 in total, quiet from 22:00
  to 07:00, held and sent at 07:00) stay far below that.
- **If the key leaks:** delete it in Resend's API Keys page, make a new one (step 3) and store it again (step 4).
- **Replies:** replies go to the `reply_to` address (yours). ORION doesn't read incoming mail.
- **Unsubscribe:** every email carries a one-click unsubscribe link to the PC's Funnel address
  (`/u/<account>/<token>`); it can only turn that account's alerts off.
- **Gmail instead:** `email-alerts` also accepts `gmail` as the provider (a Gmail account made for ORION with an App
  Password, sent over SMTP). Resend is the default.
- **Cost later:** if alerts ever outgrow the free plan, Resend's paid plan starts at about $20 a month for 50,000.
