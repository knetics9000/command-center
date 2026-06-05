# Command Center — Autonomous App

Self-hosted Next.js app that ports the Cowork Command Center artifact and adds an
autonomous layer (hourly briefings, clustering, project suggestions, per-project
chat, standing rules + watchers). Runs on a VPS with cron — acts without a live session.

## Stack
- **Next.js** (App Router) — UI + API route handlers
- **SQLite** (`better-sqlite3`, single file in `data/`)
- **Claude API** (`@anthropic-ai/sdk`) — Haiku for parse/extract, Sonnet for briefing/chat
- **Gmail + Calendar APIs** (`googleapis`) — direct, both accounts (replaces Cowork MCP)
- **Offload** — existing Apps Script endpoint over HTTPS
- **cron** — background jobs on the VPS

## Setup (local)
```bash
cp .env.example .env      # fill in keys (see Phase 1 for Google OAuth)
npm install
npm run db:init           # create the SQLite schema
npm run dev               # http://localhost:3000
```
Secrets live in `.env` (gitignored). The DB file lives in `data/` (gitignored).

## Layout
- `lib/` — `db.js` (SQLite), `schema.sql` (9 tables), and (Phase 1) `google.js`, `offload.js`, `claude.js`
- `app/` — dashboard pages + `api/` route handlers
- `scripts/` — `init-db.js`, and (Phase 3/4) `watchers.js`, `briefing.js` for cron

## Build phases
- **Phase 0 — Scaffold** ✅ Next + SQLite (9 tables) + config + runnable shell
- **Phase 1 — Integrations** — Google OAuth (both accounts) · Gmail read/modify · Calendar write · Offload read/write · Claude client
- **Phase 2 — Port UI** — inbox triage + Gmail writes, all-tag To-Do + add/+tag, projects (+auto-card `…Project` tags), calendar
- **Phase 3 — Autonomous** — hourly briefing + clustering, one-click project suggestions, per-project chat (read mail → extract → create calendar events), standing rules + 15-min watcher
- **Phase 4 — Deploy + cron** — VPS process manager + the 3 cron jobs + HTTPS

## Cron (Phase 4, on the VPS)
```
*/15 * * * *  cd /path/app && node scripts/watchers.js   # new mail + standing rules + calendar
0 * * * *     cd /path/app && node scripts/briefing.js    # regenerate briefing
30 7 * * *    cd /path/app && node scripts/briefing.js --primary
```
