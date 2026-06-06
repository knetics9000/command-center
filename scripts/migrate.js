// Idempotent schema migration. Safe to run on every deploy: ensures all tables
// exist (via db.js running schema.sql) and adds any columns introduced after a
// table was first created. Re-running is a no-op.
import "dotenv/config";
import { getDb } from "../lib/db.js";

const db = getDb(); // running schema.sql ensures all CREATE TABLE IF NOT EXISTS are applied

const COLUMNS = [
  ["emails", "project_tag", "TEXT"],
  ["emails", "etags", "TEXT"],
  ["emails", "priority", "INTEGER"],
  ["emails", "category", "TEXT"],
  ["emails", "snooze_until", "TEXT"],
  ["google_tokens", "picture", "TEXT"],
  ["tasks", "due", "TEXT"],
  ["projects", "notes", "TEXT"],
  ["standing_rules", "context_id", "TEXT"],
];

let added = 0;
for (const [table, col, type] of COLUMNS) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
  if (!exists) { db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`).run(); console.log(`+ ${table}.${col}`); added++; }
}
console.log(`migrate: ${added} column(s) added; schema up to date.`);
