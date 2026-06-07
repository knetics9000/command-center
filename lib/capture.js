// ===== Command Center side of the Offload seam =====
// Offload owns raw capture (addCapture writes the immutable raw record).
// Everything below "process" is Command Center's downstream AI layer.
import { getDb } from "./db.js";
import { askJSON, FAST } from "./claude.js";

export const MOODS = ["quick win", "deep focus", "low energy", "errand", "creative"];

// --- Offload-owned: write the raw record (spinoff candidate) ---
export function addCapture(rawText, source = "text") {
  const t = (rawText || "").trim();
  if (!t) return null;
  const info = getDb().prepare("INSERT INTO captures (raw_text,source,status) VALUES (?,?, 'unprocessed')").run(t, source === "mic" ? "mic" : "text");
  return info.lastInsertRowid;
}

// --- Command Center-owned: AI processing layer (never touches raw_text) ---
export async function processCapture(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM captures WHERE id=?").get(id);
  if (!row) return null;
  let out = {};
  try {
    out = await askJSON({
      model: FAST,
      system: "You triage Kurt's raw brain-dumps for his ADHD command center. Be decisive and concrete; turn a messy thought into one clear next action.",
      prompt: `Brain-dump: "${row.raw_text}"\n\nReturn ONE JSON object:\n{"category":"to-do|idea|errand|email|reminder|note|shopping|event","priority":"high|medium|low","summary":"<cleaned one-line version of the thought>","suggested_action":"<the concrete next step, imperative, <=10 words>","mood_energy":"<one of: ${MOODS.join(", ")}>"}\nReturn ONLY the JSON.`,
      max_tokens: 300,
    });
  } catch {}
  const mood = MOODS.includes(out.mood_energy) ? out.mood_energy : "quick win";
  const pri = ["high", "medium", "low"].includes(out.priority) ? out.priority : "medium";
  db.prepare("UPDATE captures SET category=?, priority=?, summary=?, suggested_action=?, mood_energy=?, status='processed', processed_at=datetime('now') WHERE id=?")
    .run(out.category || "note", pri, (out.summary || row.raw_text).slice(0, 300), (out.suggested_action || "").slice(0, 160), mood, id);
  return getOne(id);
}

export function getOne(id) { return getDb().prepare("SELECT * FROM captures WHERE id=?").get(id) || null; }
export function listCaptures(includeDone = false) {
  return getDb().prepare(`SELECT * FROM captures ${includeDone ? "" : "WHERE done=0"} ORDER BY id DESC LIMIT 200`).all();
}
/** Open, processed captures sorted high->low priority (for the "Right Now" view). */
export function actionableCaptures() {
  const rank = { high: 0, medium: 1, low: 2 };
  return getDb().prepare("SELECT * FROM captures WHERE done=0 AND status='processed' ORDER BY id DESC").all()
    .sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));
}
export function markDone(id, done = 1) { getDb().prepare("UPDATE captures SET done=? WHERE id=?").run(done ? 1 : 0, id); }
export function deleteCapture(id) { getDb().prepare("DELETE FROM captures WHERE id=?").run(id); }
/** Process any stragglers (e.g. if a write happened without processing). */
export async function processUnprocessed(max = 20) {
  const ids = getDb().prepare("SELECT id FROM captures WHERE status='unprocessed' ORDER BY id LIMIT ?").all(max).map((r) => r.id);
  for (const id of ids) { try { await processCapture(id); } catch {} }
  return ids.length;
}
