// Non-destructive dismissals: hide an item from Right Now / the briefing without
// mutating the underlying email, task, or capture. Keyed by a stable string so a
// dismissal survives reloads (and, for briefing priorities, regenerations).
// A dismissal with `until` set is a SNOOZE — it auto-expires and the item returns.
import { getDb } from "./db.js";

// Stable signature for free-text titles (briefing priorities reword slightly across
// regenerations; normalizing keeps a dismissal sticky).
export const sig = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);

/** Permanent dismiss (until=null) or snooze (until=future ISO). Upsert so re-snooze works. */
export function addDismissal(key, until = null) {
  if (!key) return;
  getDb().prepare("INSERT INTO dismissals (key,until) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET until=excluded.until").run(String(key), until);
}
export function removeDismissal(key) {
  if (!key) return;
  getDb().prepare("DELETE FROM dismissals WHERE key=?").run(String(key));
}
/** Only ACTIVE dismissals — permanent ones, plus snoozes that haven't expired yet. */
export function dismissalKeys() {
  return getDb()
    .prepare("SELECT key FROM dismissals WHERE until IS NULL OR datetime(until) > datetime('now')")
    .all().map((r) => r.key);
}
