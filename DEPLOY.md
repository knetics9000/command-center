# Deploying Command Center to a Hostinger VPS

This is the runbook to take the app from local → live on your VPS with HTTPS and cron.
Build locally first (already done); you run these steps on the VPS.

---

## 0. Before you start — the one thing that will bite you

**Set the Google OAuth app to "In production."** The `gmail.modify` scope is a
*restricted* scope. While your OAuth consent screen is in **Testing**, Google
**expires refresh tokens after 7 days** — the app will silently lose access to
Gmail/Calendar every week. In Google Cloud Console → *APIs & Services → OAuth
consent screen* → **Publish app** (you do **not** need full verification for
personal use with a handful of users; you'll see an "unverified app" warning on
the consent screen, which you click through).

---

## 1. VPS prerequisites (Ubuntu)

```bash
# Node 20+ (24 works; better-sqlite3 ships prebuilt binaries)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential nginx
sudo npm i -g pm2
```

`build-essential` is only a fallback in case better-sqlite3 needs to compile.

## 2. Get the code + dependencies

```bash
cd /opt
sudo git clone <your-repo-url> command-center
sudo chown -R $USER:$USER command-center
cd command-center
npm ci
```

## 3. Environment

Create `/opt/command-center/.env` (NEVER commit this file — it's gitignored):

```ini
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL_FAST=claude-haiku-4-5
CLAUDE_MODEL_SMART=claude-sonnet-4-6

GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
# IMPORTANT: production redirect, not localhost:
GOOGLE_REDIRECT_URI=https://YOURDOMAIN/api/google/callback

OFFLOAD_URL=https://script.google.com/macros/s/.../exec
OFFLOAD_TOKEN=...
OFFLOAD_SHEET_ID=...

DATABASE_PATH=/opt/command-center/data/command-center.db
```

In **Google Cloud Console → Credentials → your OAuth client**, add the same
`https://YOURDOMAIN/api/google/callback` to **Authorized redirect URIs**.

## 4. Initialize the database + build

```bash
npm run db:init      # creates data/command-center.db with all 9 tables
npm run build
```

## 5. Run it (pm2)

```bash
pm2 start npm --name command-center -- start      # next start, serves :3000
pm2 save
pm2 startup        # follow the printed command so it survives reboots
```

## 6. HTTPS via nginx + certbot

`/etc/nginx/sites-available/command-center`:

```nginx
server {
  server_name YOURDOMAIN;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/command-center /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOURDOMAIN     # provisions + auto-renews the cert
```

## 7. Connect both Google accounts

Visit `https://YOURDOMAIN/connect`, click **Connect** for *personal*
(kingkurt1978@gmail.com) and *work* (kurt@cybertechs24.com). Approve the
consent screen (click through the "unverified app" warning). You should see
**both accounts connected ✓** on the dashboard.

## 8. Cron (the autonomy)

`crontab -e` — note `cd` first so `.env` and the DB path resolve:

```cron
# Watchers: sync mail/tasks + run standing rules, every 15 min
*/15 * * * * cd /opt/command-center && /usr/bin/npm run watchers >> /opt/command-center/data/cron.log 2>&1

# Briefing: regenerate hourly
0 * * * * cd /opt/command-center && /usr/bin/npm run briefing >> /opt/command-center/data/cron.log 2>&1

# Primary briefing: flag the 7:30 AM run as the day's headline
30 7 * * * cd /opt/command-center && /usr/bin/npm run briefing -- --primary >> /opt/command-center/data/cron.log 2>&1
```

(Set the VPS timezone so 7:30 means your local 7:30: `sudo timedatectl set-timezone America/New_York`.)

## 9. Updating later

```bash
cd /opt/command-center && git pull && npm ci && npm run build && pm2 restart command-center
```

---

## Housekeeping (one-time)

- **Delete the "Walk the dog" test task** in the Offload app (swipe-delete) — it
  was written during early artifact testing.
- Confirm `.env` is **not** in git: `git status` should never show it. The
  Offload token now lives only in `.env`, closing the old "main deliverable
  isn't in git" gap.

## Safety model (what runs without asking)

- **Inbox actions** (Archive/Done/Spam/Restore) are reversible Gmail label
  changes — nothing is ever permanently deleted.
- **Chat** can read mail and *propose* events but never creates them; you click
  **Confirm** (the irreversible step).
- **Standing rules** *do* create calendar events autonomously — that is the
  pre-authorization you grant by saving the rule. They dedupe on title+start so
  re-runs never double-book, and every created event is logged with its rule id.
