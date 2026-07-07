-- Command Center — SQLite schema (single file on the VPS)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Offload items (mirror of the Offload Live sheet + locally added)
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,         -- Offload id (i_...) or local (u_...) until phone stamps it
  text         TEXT NOT NULL,
  tags         TEXT DEFAULT '',          -- full "; "-joined tag string
  type         TEXT DEFAULT 'task',      -- task|grocery_item|note|reminder|idea|project|follow_up
  status       TEXT DEFAULT 'open',      -- open|completed|archived|done
  source       TEXT DEFAULT 'offload',
  created_at   TEXT,
  due          TEXT,                     -- optional due date (YYYY-MM-DD), set in-app, preserved across syncs
  prime        INTEGER DEFAULT 0,        -- pinned to the Prime list, set in-app, preserved across syncs
  synced       INTEGER DEFAULT 1,        -- 0 = added here, awaiting a real Offload id
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- Cached, parsed mail from both accounts
CREATE TABLE IF NOT EXISTS emails (
  id           TEXT PRIMARY KEY,         -- gmail message id
  account      TEXT NOT NULL,            -- 'personal' | 'work'
  thread_id    TEXT,
  sender       TEXT,
  sender_addr  TEXT,
  subject      TEXT,
  snippet      TEXT,
  body         TEXT,
  received_at  TEXT,
  triage_tier  TEXT,                     -- act|review|quick|noise
  why          TEXT,
  action       TEXT,
  risk         INTEGER DEFAULT 0,
  risk_why     TEXT,
  cluster_id   INTEGER REFERENCES clusters(id),
  handled      INTEGER DEFAULT 0,
  handled_state TEXT,                    -- archived|done|spam|snoozed
  snooze_until TEXT,                     -- ISO time to return a snoozed email to the board
  project_tag  TEXT,                     -- manually assigned project (survives sync)
  etags        TEXT,                     -- custom "; "-joined tags on the email
  priority     INTEGER,                  -- explicit: 1 priority, 0 not, NULL unset (AI suggests)
  category     TEXT,                     -- AI life-category bucket
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- Learns Kurt's priority preferences by sender/domain (the feedback loop)
CREATE TABLE IF NOT EXISTS priority_feedback (
  key         TEXT PRIMARY KEY,          -- lowercased sender addr, or "@domain"
  kind        TEXT,                      -- sender | domain
  decision    INTEGER,                   -- 1 priority, 0 not
  count       INTEGER DEFAULT 1,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Detected themes (e.g. "i9 Sports", "Condo security system")
CREATE TABLE IF NOT EXISTS clusters (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  summary      TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- Created / auto-detected projects
CREATE TABLE IF NOT EXISTS projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  tag          TEXT,                     -- the Offload tag that backs it (e.g. "Command Center Project")
  cluster_id   INTEGER REFERENCES clusters(id),
  source       TEXT DEFAULT 'manual',    -- auto | suggested | manual
  status       TEXT DEFAULT 'active',
  notes        TEXT,                     -- context the project chat reads (goals, people, constraints)
  created_at   TEXT DEFAULT (datetime('now'))
);

-- Persistent standing instructions, run by the watcher
CREATE TABLE IF NOT EXISTS standing_rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   INTEGER REFERENCES projects(id),
  context_id   TEXT,                     -- project tag this rule belongs to
  instruction  TEXT NOT NULL,
  enabled      INTEGER DEFAULT 1,
  last_run     TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- Generated briefings
CREATE TABLE IF NOT EXISTS briefings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  content      TEXT NOT NULL,            -- JSON (clusters + prioritized bullets)
  generated_at TEXT DEFAULT (datetime('now')),
  is_primary   INTEGER DEFAULT 0         -- the day's 7:30 AM primary
);

-- Chat history (per project, or per briefing item via context_*)
CREATE TABLE IF NOT EXISTS chat_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   INTEGER REFERENCES projects(id),
  context_type TEXT DEFAULT 'project',   -- project | briefing
  context_id   TEXT,
  role         TEXT NOT NULL,            -- user | assistant
  content      TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- Calendar events the system created
CREATE TABLE IF NOT EXISTS calendar_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id          INTEGER REFERENCES standing_rules(id),
  project_id       INTEGER REFERENCES projects(id),
  gcal_event_id    TEXT,
  calendar_account TEXT,
  title            TEXT,
  location         TEXT,
  start            TEXT,
  end              TEXT,
  source           TEXT DEFAULT 'rule',
  created_at       TEXT DEFAULT (datetime('now'))
);

-- AI cleanup organizer suggestions (duplicates, mistags, incomplete, project ideas)
CREATE TABLE IF NOT EXISTS cleanup_suggestions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,          -- mistag | duplicate | incomplete | project | uncategorized
  payload     TEXT NOT NULL,          -- JSON specific to the kind
  why         TEXT,
  status      TEXT DEFAULT 'pending', -- pending | accepted | dismissed
  signature   TEXT,                   -- dedupe key so re-runs don't repeat
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Small key/value store (e.g. last-seen data fingerprint for the watcher)
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Google OAuth tokens per account (with refresh handling)
CREATE TABLE IF NOT EXISTS google_tokens (
  account       TEXT PRIMARY KEY,        -- 'personal' | 'work'
  email         TEXT,
  picture       TEXT,                    -- profile photo URL
  access_token  TEXT,
  refresh_token TEXT,
  expiry        INTEGER,                 -- epoch ms
  scope         TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- Items shared into the Command Center via the Web Share Target — AI knowledge layer.
CREATE TABLE IF NOT EXISTS shared_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT,                        -- original source title
  url         TEXT,
  text        TEXT,
  kind        TEXT,                        -- video|article|social|pdf|podcast|link
  ai_title    TEXT,                        -- AI "true title"
  categories  TEXT DEFAULT '[]',           -- JSON array of content categories
  summary     TEXT,                        -- executive summary
  takeaways   TEXT DEFAULT '[]',           -- JSON array
  insights    TEXT DEFAULT '[]',           -- JSON array (actionable)
  tools       TEXT DEFAULT '[]',           -- JSON array
  people      TEXT DEFAULT '[]',           -- JSON array
  projects    TEXT DEFAULT '[]',           -- JSON array of suggested project tags
  credibility INTEGER,                     -- 0-100 AI estimate
  cred_reason TEXT,
  analyzed    INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ===== SPINOFF CANDIDATE: Offload capture (raw brain-dumps) =====
-- Clean integration seam: Offload owns raw capture (id/timestamp/raw_text/source/
-- status); Command Center writes the AI layer on top. raw_text is never overwritten.
CREATE TABLE IF NOT EXISTS captures (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_text        TEXT NOT NULL,            -- the brain-dump, untouched
  source          TEXT DEFAULT 'text',      -- mic | text
  status          TEXT DEFAULT 'unprocessed', -- unprocessed | processed
  category        TEXT,
  priority        TEXT,                     -- high | medium | low (bucket derived from score)
  priority_score  INTEGER,                  -- 0-100 AI importance, independent of recency
  summary         TEXT,                     -- cleaned, de-noised
  suggested_action TEXT,                    -- concrete next step
  mood_energy     TEXT,                     -- quick win | deep focus | low energy | errand | creative
  done            INTEGER DEFAULT 0,
  origin          TEXT DEFAULT 'app',       -- app | offload (which path captured it)
  task_id         TEXT,                     -- linked Offload task (for offload-origin captures)
  created_at      TEXT DEFAULT (datetime('now')),
  processed_at    TEXT
);

-- Phone notifications captured by the Android NotificationListener app.
CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  app          TEXT,                      -- source app (package/label)
  title        TEXT,
  body         TEXT,
  link         TEXT,
  posted_at    TEXT,                      -- device timestamp (ISO)
  status       TEXT DEFAULT 'new',        -- new | dismissed | snoozed | tasked
  snooze_until TEXT,
  category     TEXT,                      -- AI tag: message|alert|finance|calendar|delivery|social|promo|media|app|other
  importance   INTEGER,                   -- AI 0-100
  flagged      INTEGER DEFAULT 0,         -- AI says this needs Kurt's attention
  why          TEXT,                      -- short AI reason
  analyzed     INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status, id);

-- Non-destructive "dismiss from view" — hides an item from Right Now / the briefing
-- without touching the underlying email/task. key = e.g. now:e<id>, now:t<id>, brief:<sig>.
CREATE TABLE IF NOT EXISTS dismissals (
  key        TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guru_influences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  why         TEXT,
  style_notes TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guru_materials (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  url          TEXT,
  kind         TEXT,
  title        TEXT,
  text         TEXT,
  ai_title     TEXT,
  categories   TEXT,
  summary      TEXT,
  takeaways    TEXT,
  insights     TEXT,
  tools        TEXT,
  people       TEXT,
  credibility  INTEGER,
  cred_reason  TEXT,
  influence_id INTEGER,
  source       TEXT,
  type         TEXT DEFAULT 'material',
  analyzed     INTEGER DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coach_interactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT,
  situation       TEXT,
  short_answer    TEXT,
  retrieved_ids   TEXT,
  source_ids      TEXT,
  deep            TEXT,
  created_at      INTEGER NOT NULL
);

-- Co-parent inbox (kmriedel0214@gmail.com) — shared kid-logistics account.
-- Kept separate from `emails` so it never mixes into the main inbox/briefing.
CREATE TABLE IF NOT EXISTS coparent_emails (
  id           TEXT PRIMARY KEY,          -- gmail message id
  thread_id    TEXT,
  sender       TEXT,
  sender_addr  TEXT,
  subject      TEXT,
  snippet      TEXT,
  received_at  TEXT,
  kid          TEXT,                      -- Kurt | Nova | Jayden | All
  important    INTEGER DEFAULT 0,         -- AI: Kurt needs to know this
  why          TEXT,                      -- short AI reason
  action       TEXT,                      -- concrete next step, if any
  analyzed     INTEGER DEFAULT 0,
  seen         INTEGER DEFAULT 0,         -- Kurt tapped "got it"
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_coparent_kid ON coparent_emails(kid, important, seen);

-- Generalized learning loop: Kurt's corrections teach the classifiers.
-- domain = notif|kids|...  key = app package / sender addr.  score accumulates.
CREATE TABLE IF NOT EXISTS feedback (
  domain     TEXT NOT NULL,
  key        TEXT NOT NULL,
  score      INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (domain, key)
);

-- Offload "thoughts": long-form voice/typed captures, AI-cleaned + bullet-summarized,
-- pulled from the Offload Apps Script Web App ('Thoughts' tab). Upsert by id.
CREATE TABLE IF NOT EXISTS thoughts (
  id                 TEXT PRIMARY KEY,     -- t_<uuid> from the sheet
  created_at         TEXT,                 -- 'yyyy-MM-dd HH:mm' (capture time, local)
  raw_text           TEXT,                 -- original verbatim capture
  retextualized_text TEXT,                 -- AI-cleaned full prose
  summary            TEXT,                 -- newline-separated '• ' bullets
  source             TEXT,                 -- voice | typed
  synced_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_thoughts_created ON thoughts(created_at);
