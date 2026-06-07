// ===== Command Center side of the Offload seam =====
// Offload owns raw capture (addCapture writes the immutable raw record).
// Everything below "process" is Command Center's downstream AI layer.
import { getDb } from "./db.js";
import { askJSON, FAST } from "./claude.js";
import { getMeta, setMeta } from "./meta.js";
import { completeTask } from "./offload.js";

export const MOODS = ["quick win", "deep focus", "low energy", "errand", "creative"];
const isReal = (id) => id && !String(id).startsWith("u_");

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
// hide captures that are done, OR whose linked Offload task was completed elsewhere
const OPEN_FILTER = "done=0 AND (task_id IS NULL OR task_id IN (SELECT id FROM tasks WHERE status='open'))";
export function listCaptures(includeDone = false) {
  return getDb().prepare(`SELECT * FROM captures ${includeDone ? "" : "WHERE " + OPEN_FILTER} ORDER BY id DESC LIMIT 200`).all();
}
export async function markDone(id, done = 1) {
  const db = getDb();
  const cap = db.prepare("SELECT task_id FROM captures WHERE id=?").get(id);
  db.prepare("UPDATE captures SET done=? WHERE id=?").run(done ? 1 : 0, id);
  if (done && cap && cap.task_id) { // sync completion back to the linked Offload task
    try { if (isReal(cap.task_id)) await completeTask(cap.task_id); } catch {}
    db.prepare("UPDATE tasks SET status='completed', updated_at=datetime('now') WHERE id=?").run(cap.task_id);
  }
}
export function deleteCapture(id) { getDb().prepare("DELETE FROM captures WHERE id=?").run(id); }
/** Process any stragglers (e.g. if a write happened without processing). */
export async function processUnprocessed(max = 20) {
  const ids = getDb().prepare("SELECT id FROM captures WHERE status='unprocessed' ORDER BY id LIMIT ?").all(max).map((r) => r.id);
  for (const id of ids) { try { await processCapture(id); } catch {} }
  return ids.length;
}

/** Route NEW Offload-sheet brain-dumps through the AI layer into Right Now.
 *  On first activation, every existing open task is snapshotted as "seen" (so the
 *  backlog isn't flooded); only dumps added afterward are captured. The task_id
 *  link is the dedupe key, so this is independent of date formats. Grocery/shopping
 *  list items are skipped. */
export async function captureNewOffloadTasks(limit = 12) {
  const db = getDb();
  if (!getMeta("offload_capture_init")) {
    db.prepare("INSERT INTO captures (raw_text,task_id,origin,status,done) SELECT text,id,'offload','skipped',1 FROM tasks WHERE status='open' AND type='task' AND id NOT IN (SELECT task_id FROM captures WHERE task_id IS NOT NULL)").run();
    setMeta("offload_capture_init", "1");
    return 0;
  }
  const rows = db.prepare(
    `SELECT id,text FROM tasks
       WHERE status='open' AND type='task'
         AND lower(COALESCE(tags,'')) NOT LIKE '%grocery%' AND lower(COALESCE(tags,'')) NOT LIKE '%shopping%'
         AND id NOT IN (SELECT task_id FROM captures WHERE task_id IS NOT NULL)
       ORDER BY rowid DESC LIMIT ?`
  ).all(limit);
  let n = 0;
  for (const t of rows) {
    const info = db.prepare("INSERT INTO captures (raw_text,source,status,origin,task_id) VALUES (?,?, 'unprocessed','offload',?)").run(t.text, "text", t.id);
    try { await processCapture(info.lastInsertRowid); } catch {}
    n++;
  }
  return n;
}
