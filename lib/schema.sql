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

-- Items shared into the Command Center via the Web Share Target.
CREATE TABLE IF NOT EXISTS shared_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT,
  url        TEXT,
  text       TEXT,
  category   TEXT,
  kind       TEXT,                        -- video|article|product|link|note|other
  created_at TEXT DEFAULT (datetime('now'))
);
