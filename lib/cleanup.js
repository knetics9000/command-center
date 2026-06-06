// AI Cleanup organizer — reviews open tasks and proposes high-confidence fixes:
// duplicates, mis-tags, vague/incomplete, uncategorized, and 5+ related → project.
// Suggestions are cached; dismissed/accepted signatures are remembered so re-runs
// don't repeat them. Applying a suggestion performs the real change (retag/merge/
// rewrite/create project) and syncs to Offload for real ids.
import { getDb } from "./db.js";
import { askJSON, SMART } from "./claude.js";
import { getOpenTasks } from "./queries.js";
import { tagsOf } from "./tags.js";
import { retagTask, completeTask, upsertOffload } from "./offload.js";
import { BUCKETS } from "./buckets.js";
export { BUCKETS };

const SYS =
  "You are Kurt's meticulous chief-of-staff organizing his task list. You find duplicates, mis-tagged tasks, vague/incomplete tasks, uncategorized tasks, and clusters of 5+ related tasks that should become a project. Only suggest high-confidence fixes — quality over quantity.";

const sig = (s) => {
  if (s.kind === "duplicate") return "dup:" + [s.keepId, ...(s.dupeIds || [])].filter(Boolean).sort().join(",");
  if (s.kind === "project") return "proj:" + (s.name || "") + ":" + (s.taskIds || []).slice().sort().join(",");
  return s.kind + ":" + (s.taskId || "");
};

export async function generateCleanup() {
  const db = getDb();
  const tasks = getOpenTasks().filter((t) => t.type !== "grocery_item");
  if (!tasks.length) return { added: 0, total: 0 };
  const existingTags = [...new Set(tasks.flatMap((t) => tagsOf(t.tags)))];

  const prompt =
    `Open tasks (id, text, tags):\n${JSON.stringify(tasks.map((t) => ({ id: t.id, text: t.text, tags: t.tags })))}\n\n` +
    `Existing tags: ${existingTags.join(", ")}\nPreferred life-category buckets: ${BUCKETS.join(", ")}\n\n` +
    `Return ONE JSON object {"suggestions":[ ... ]}. Each item is exactly one of:\n` +
    `{"kind":"duplicate","keepId":"<id>","dupeIds":["<id>",...],"text":"<the task>","why":"..."}\n` +
    `{"kind":"mistag","taskId":"<id>","text":"<task>","current":"<existing tag or '(untagged)'>","suggested":"<better tag; prefer a bucket>","why":"..."}\n` +
    `{"kind":"incomplete","taskId":"<id>","text":"<task>","suggestedText":"<clearer rewrite>","why":"..."}\n` +
    `{"kind":"uncategorized","taskId":"<id>","text":"<task>","suggested":"<bucket tag>","why":"..."}\n` +
    `{"kind":"project","name":"<project name; prefer a bucket>","taskIds":["<id>",... at least 5],"why":"..."}\n` +
    `Rules: only high-confidence items. Projects need 5+ genuinely related tasks. Use the real ids. At most 12 suggestions. Each "why" <= 22 words. Return ONLY the JSON object.`;

  let data;
  try { data = await askJSON({ model: SMART, system: SYS, prompt, max_tokens: 4000 }); }
  catch { return { added: 0, total: 0, error: "ai failed" }; }
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  const settled = new Set(db.prepare("SELECT signature FROM cleanup_suggestions WHERE status IN ('dismissed','accepted')").all().map((r) => r.signature));
  db.prepare("DELETE FROM cleanup_suggestions WHERE status='pending'").run();
  const ins = db.prepare("INSERT INTO cleanup_suggestions (kind,payload,why,signature) VALUES (?,?,?,?)");
  let added = 0;
  const seen = new Set();
  for (const s of suggestions) {
    if (!s || !s.kind) continue;
    const g = sig(s);
    if (settled.has(g) || seen.has(g)) continue;
    seen.add(g);
    ins.run(s.kind, JSON.stringify(s), s.why || "", g);
    added++;
  }
  return { added, total: suggestions.length };
}

const ORDER = "CASE kind WHEN 'project' THEN 0 WHEN 'duplicate' THEN 1 WHEN 'mistag' THEN 2 WHEN 'uncategorized' THEN 3 ELSE 4 END";
export function listCleanup() {
  return getDb().prepare(`SELECT id,kind,payload,why FROM cleanup_suggestions WHERE status='pending' ORDER BY ${ORDER}, id`).all()
    .map((r) => ({ id: r.id, kind: r.kind, why: r.why, ...JSON.parse(r.payload) }));
}
export function cleanupCount() {
  return getDb().prepare("SELECT COUNT(*) c FROM cleanup_suggestions WHERE status='pending'").get().c;
}
export function dismissSuggestion(id) {
  getDb().prepare("UPDATE cleanup_suggestions SET status='dismissed' WHERE id=?").run(id);
}

const isReal = (tid) => tid && !tid.startsWith("u_");

export async function acceptSuggestion(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM cleanup_suggestions WHERE id=?").get(id);
  if (!row) throw new Error("not found");
  const s = JSON.parse(row.payload);

  async function retag(tid, tags) { if (isReal(tid)) await retagTask(tid, tags); db.prepare("UPDATE tasks SET tags=?, updated_at=datetime('now') WHERE id=?").run(tags, tid); }
  const curTags = (tid) => tagsOf((db.prepare("SELECT tags FROM tasks WHERE id=?").get(tid) || {}).tags);

  if (s.kind === "mistag" || s.kind === "uncategorized") {
    let next;
    if (s.kind === "mistag" && s.current && s.current !== "(untagged)")
      next = Array.from(new Set([...curTags(s.taskId).filter((x) => x.toLowerCase() !== s.current.toLowerCase()), s.suggested]));
    else next = Array.from(new Set([...curTags(s.taskId), s.suggested]));
    await retag(s.taskId, next.filter(Boolean).join("; "));
  } else if (s.kind === "duplicate") {
    for (const did of s.dupeIds || []) { if (isReal(did)) await completeTask(did); db.prepare("UPDATE tasks SET status='completed' WHERE id=?").run(did); }
  } else if (s.kind === "incomplete") {
    const txt = (s.suggestedText || "").trim();
    if (txt) { if (isReal(s.taskId)) await upsertOffload([{ id: s.taskId, text: txt }]); db.prepare("UPDATE tasks SET text=? WHERE id=?").run(txt, s.taskId); }
  } else if (s.kind === "project") {
    const name = s.name || "Project";
    const tag = /project/i.test(name) ? name : name + " Project";
    if (!db.prepare("SELECT id FROM projects WHERE lower(tag)=lower(?)").get(tag))
      db.prepare("INSERT INTO projects (name,tag,source,status) VALUES (?,?,'suggested','active')").run(name.replace(/\s*project\s*$/i, "").trim() || name, tag);
    for (const tid of s.taskIds || []) { if (!db.prepare("SELECT 1 FROM tasks WHERE id=?").get(tid)) continue; await retag(tid, Array.from(new Set([...curTags(tid), tag])).join("; ")); }
  }
  db.prepare("UPDATE cleanup_suggestions SET status='accepted' WHERE id=?").run(id);
  return { ok: true, kind: s.kind };
}
