// Non-destructive dismissals: hide an item from Right Now / the briefing without
// mutating the underlying email, task, or capture. Keyed by a stable string so a
// dismissal survives reloads (and, for briefing priorities, regenerations).
import { getDb } from "./db.js";

// Stable signature for free-text titles (briefing priorities reword slightly across
// regenerations; normalizing keeps a dismissal sticky).
export const sig = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);

export function addDismissal(key) {
  if (!key) return;
  getDb().prepare("INSERT OR IGNORE INTO dismissals (key) VALUES (?)").run(String(key));
}
export function removeDismissal(key) {
  if (!key) return;
  getDb().prepare("DELETE FROM dismissals WHERE key=?").run(String(key));
}
export function dismissalKeys() {
  return getDb().prepare("SELECT key FROM dismissals").all().map((r) => r.key);
}
