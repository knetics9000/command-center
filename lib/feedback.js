// Generalized learning loop. Kurt's actions (flagging noise as important,
// dismissing things the AI thought urgent) accumulate per-source scores that
// nudge future classification toward his actual preferences.
import { getDb } from "./db.js";

export function recordFeedback(domain, key, delta = 1) {
  if (!domain || !key) return;
  getDb().prepare(
    `INSERT INTO feedback (domain,key,score,updated_at) VALUES (?,?,?,datetime('now'))
     ON CONFLICT(domain,key) DO UPDATE SET score = score + excluded.score, updated_at = datetime('now')`
  ).run(domain, String(key).toLowerCase(), delta);
}

export function feedbackMap(domain) {
  const m = {};
  for (const r of getDb().prepare("SELECT key,score FROM feedback WHERE domain=?").all(domain)) m[r.key] = r.score;
  return m;
}
