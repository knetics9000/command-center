// AI Cleanup organizer — reviews open tasks and proposes high-confidence fixes:
// duplicates, mis-tags, vague/incomplete, uncategorized, and 5+ related → project.
// Suggestions are cached; dismissed/accepted signatures are remembered so re-runs
// don't repeat them. Applying a suggestion performs the real change (retag/merge/
// rewrite/create project) and syncs to Offload for real ids.
import { getDb } from "./db.js";
import { askJSON, SMART, FAST } from "./claude.js";
import { getOpenTasks } from "./queries.js";
import { tagsOf } from "./tags.js";
import { retagTask, completeTask, upsertOffload, addTask } from "./offload.js";
import { createEvent, deleteEvent, listEvents } from "./google.js";
import { BUCKETS } from "./buckets.js";
export { BUCKETS };

const SYS =
  "You are Kurt's meticulous chief-of-staff organizing his task list. You find duplicates, mis-tagged tasks, vague/incomplete tasks, uncategorized tasks, and clusters of 5+ related tasks that should become a project. Only suggest high-confidence fixes — quality over quantity.";

const sig = (s) => {
  if (s.kind === "duplicate") return "dup:" + [s.keepId, ...(s.dupeIds || [])].filter(Boolean).sort().join(",");
  if (s.kind === "project") return "proj:" + (s.name || "") + ":" + (s.taskIds || []).slice().sort().join(",");
  if (s.kind === "calendar") return "cal:" + (s.title || "").toLowerCase().slice(0, 40) + ":" + (s.date || "");
  if (s.kind === "caldup") return "caldup:" + (s.drop && s.drop.id || "");
  return s.kind + ":" + (s.taskId || "");
};

/** Find duplicate events already on the calendar (same title + same start). */
async function detectCalendarDuplicates() {
  const min = new Date().toISOString();
  const max = new Date(Date.now() + 90 * 86400e3).toISOString();
  let evs = [];
  for (const acc of ["personal", "work"]) {
    try { for (const e of await listEvents(acc, min, max)) evs.push({ account: acc, id: e.id, title: e.summary || "(busy)", start: (e.start && (e.start.dateTime || e.start.date)) || "" }); } catch {}
  }
  const norm = (t) => (t || "").trim().toLowerCase().replace(/\s+/g, " ");
  const groups = {};
  for (const e of evs) { if (!e.id || !e.start) continue; const key = norm(e.title) + "|" + e.start.slice(0, 16); (groups[key] = groups[key] || []).push(e); }
  const out = [];
  for (const key of Object.keys(groups)) {
    const g = groups[key]; if (g.length < 2) continue;
    const keep = g[0];
    for (let i = 1; i < g.length; i++) {
      const drop = g[i];
      out.push({ kind: "caldup", title: drop.title, date: drop.start.slice(0, 10), time: /T/.test(drop.start) ? drop.start.slice(11, 16) : "", keep: { account: keep.account, id: keep.id }, drop: { account: drop.account, id: drop.id }, why: `Two "${drop.title}" events at the same time — keep one, delete the duplicate.` });
    }
  }
  return out.slice(0, 10);
}

/** A hash of current tasks + inbox state — changes when anything meaningful does. */
export function dataFingerprint() {
  const db = getDb();
  const tasks = db.prepare("SELECT id,status,text FROM tasks WHERE type!='grocery_item' ORDER BY id").all();
  const em = db.prepare("SELECT COUNT(*) c, MAX(received_at) m, SUM(handled) h, SUM(COALESCE(priority,0)) p FROM emails").get();
  const s = tasks.map((t) => t.id + t.status + t.text).join("|") + "::" + em.c + "/" + em.m + "/" + em.h + "/" + em.p;
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

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
  catch { data = { suggestions: [] }; }
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  // second pass: scan tasks + emails for dated commitments to put on the calendar
  const calItems = await detectCalendarItems(tasks);
  for (const c of calItems) suggestions.push(c);
  // third pass: find duplicate events already on the calendar
  try { for (const d of await detectCalendarDuplicates()) suggestions.push(d); } catch {}

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

/** Scan open tasks + unhandled non-noise emails for concrete dated commitments. */
async function detectCalendarItems(tasks) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const emails = db.prepare(
    "SELECT id,sender,subject,snippet,received_at FROM emails WHERE handled=0 AND triage_tier!='noise' ORDER BY datetime(received_at) DESC LIMIT 60"
  ).all();
  const onCal = new Set(db.prepare("SELECT lower(title) t FROM calendar_events").all().map((r) => r.t));

  const payload = {
    tasks: tasks.map((t) => ({ id: t.id, text: t.text, tags: t.tags })),
    emails: emails.map((e) => ({ from: e.sender, subject: e.subject, preview: (e.snippet || "").slice(0, 180) })),
  };
  const prompt =
    `Today is ${today} (America/New_York). From these emails and tasks, find concrete dated commitments, deadlines, appointments, expirations, renewals, games/practices, or bills due that belong on Kurt's calendar.\n\n` +
    `${JSON.stringify(payload)}\n\n` +
    `Return ONE JSON object {"items":[ {"kind":"calendar","title":"<short event title>","date":"YYYY-MM-DD","time":"HH:MM or ''","allDay":true|false,"source":"email"|"task","why":"<=18 words, mention the date"} ]}. ` +
    `Rules: only items with a clear SPECIFIC future date (today or later). Resolve relative dates against today. Use allDay=true when no clock time. At most 8. Return ONLY the JSON object.`;

  let out;
  try { out = await askJSON({ model: FAST, system: "You extract calendar-worthy dated commitments from Kurt's mail and tasks.", prompt, max_tokens: 1500 }); }
  catch { return []; }
  const items = Array.isArray(out.items) ? out.items : [];
  return items.filter((c) => c && c.title && /^\d{4}-\d{2}-\d{2}$/.test(c.date || "") && c.date >= today && !onCal.has((c.title || "").toLowerCase()));
}

const ORDER = "CASE kind WHEN 'caldup' THEN 0 WHEN 'calendar' THEN 1 WHEN 'project' THEN 2 WHEN 'duplicate' THEN 3 WHEN 'mistag' THEN 4 WHEN 'uncategorized' THEN 5 ELSE 6 END";
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
  } else if (s.kind === "calendar") {
    const allDay = s.allDay || !s.time;
    let start = s.date, end;
    if (!allDay) {
      start = new Date(`${s.date}T${s.time}:00`).toISOString();
      end = new Date(new Date(start).getTime() + 60 * 60000).toISOString();
    }
    const ev = await createEvent("personal", { summary: s.title, allDay, start, end });
    db.prepare("INSERT INTO calendar_events (gcal_event_id,calendar_account,title,start,end,source) VALUES (?,?,?,?,?, 'cleanup')")
      .run(ev.id, "personal", s.title, allDay ? s.date : start, end || "");
  } else if (s.kind === "caldup") {
    await deleteEvent(s.drop.account, s.drop.id);
    db.prepare("DELETE FROM calendar_events WHERE gcal_event_id=?").run(s.drop.id);
  }
  db.prepare("UPDATE cleanup_suggestions SET status='accepted' WHERE id=?").run(id);
  return { ok: true, kind: s.kind };
}
