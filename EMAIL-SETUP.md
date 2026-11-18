# EMAIL-SETUP.md: ORION's email through Resend

ORION sends email alerts from your own domain (the one that will serve the web app) through Resend.
The plan for the backend is in SYNC.md under "Email alerts". **No secrets go in this file or in the repo.**

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

## 4. Store the key on the PC

On the Windows PC that runs ORION, store it in Windows Credential Manager under the name the backend reads:

- Target: `Orion-assistant`
- User: `email:resend_api_key`
- Password: the API key

**Easiest way, once the backend adds it:** `python orion_connect.py email`. It asks for the key with hidden typing,
saves it and sends you a test email.

**By hand, until then:** in PowerShell, from the ORION folder:

```powershell
python -c "import keyring, getpass; keyring.set_password('Orion-assistant', 'email:resend_api_key', getpass.getpass('Resend key: '))"
```

## 5. Tell ORION the address

Put the sender (not the key) in ORION's `config.json`:

```json
"email": {
  "provider": "resend",
  "from": "ORION <orion@alerts.yourdomain.com>",
  "reply_to": "your own email",
  "site": "https://yourdomain.com"
}
```

## 6. Test it

1. Restart ORION.
2. In the web UI, open the envelope in the top bar, enter your own email and confirm the 6-digit code.
3. The code email should arrive from "ORION". If it lands in spam, mark it **Not spam** once. Resend's
   **Emails** page shows every send and whether it was delivered.

## Good to know

- **Limits:** the free plan is 100 a day. ORION's own caps (3 per account a day, 10 in total, quiet from 22:00
  to 07:00) stay far below that.
- **If the key leaks:** delete it in Resend's API Keys page, make a new one (step 3) and store it again (step 4).
- **Replies:** replies go to the `reply_to` address (yours). ORION doesn't read incoming mail.
- **Cost later:** if alerts ever outgrow the free plan, Resend's paid plan starts at about $20 a month for 50,000.
