// Email priority + the learning loop. Explicit user decisions win; otherwise the
// AI/heuristic suggests, biased by what Kurt has prioritized before (per sender
// and per domain). Marking an email teaches future suggestions.
import { getDb } from "./db.js";

const domainOf = (addr) => "@" + ((addr || "").split("@")[1] || "").toLowerCase();

export function recordFeedback(senderAddr, decision) {
  const db = getDb();
  const up = db.prepare(
    `INSERT INTO priority_feedback (key,kind,decision,count,updated_at) VALUES (?,?,?,1,datetime('now'))
     ON CONFLICT(key) DO UPDATE SET decision=excluded.decision, count=count+1, updated_at=datetime('now')`
  );
  const s = (senderAddr || "").toLowerCase();
  if (s) up.run(s, "sender", decision ? 1 : 0);
  const d = domainOf(senderAddr);
  if (d.length > 1) up.run(d, "domain", decision ? 1 : 0);
}

export function feedbackMap() {
  const m = {};
  for (const r of getDb().prepare("SELECT key,decision FROM priority_feedback").all()) m[r.key] = r.decision;
  return m;
}

/** What the system suggests (no explicit decision yet). Returns {p, why}. */
export function suggestedPriority(e, fb) {
  const s = (e.sender_addr || "").toLowerCase();
  const d = domainOf(e.sender_addr);
  if (s in fb) return { p: fb[s], why: fb[s] ? "You usually prioritize this sender" : "You usually skip this sender" };
  if (d in fb) return { p: fb[d], why: fb[d] ? "You usually prioritize this domain" : "You usually skip this domain" };
  if (e.triage_tier === "act") return { p: 1, why: e.why || "Flagged as act-now" };
  return { p: 0, why: "" };
}

/** Final priority: explicit decision if set, else the suggestion. */
export function effectivePriority(e, fb) {
  if (e.priority === 1 || e.priority === 0) return { p: e.priority, why: e.priority ? "You marked this priority" : "You marked this not-priority", explicit: true };
  return { ...suggestedPriority(e, fb), explicit: false };
}

export function getPriorityInbox(limit = 50) {
  const db = getDb();
  const fb = feedbackMap();
  const rows = db.prepare("SELECT * FROM emails WHERE handled=0 ORDER BY datetime(received_at) DESC").all();
  return rows.map((e) => ({ ...e, ...effectivePriority(e, fb) })).filter((e) => e.p === 1).slice(0, limit);
}
