// Read helpers for the dashboard (all from SQLite cache).
import { getDb } from "./db.js";
import { tagsOf, tagClass } from "./tags.js";
export { tagsOf, tagClass };

export function getOpenTasks() {
  return getDb().prepare("SELECT * FROM tasks WHERE status='open' ORDER BY created_at DESC").all();
}

/** Group every open task by each of its tags (the all-tag To-Do). */
export function getTodoGroups() {
  const tasks = getOpenTasks();
  const groups = {};
  for (const it of tasks) {
    const tags = tagsOf(it.tags);
    (tags.length ? tags : ["Untagged"]).forEach((t) => (groups[t] = groups[t] || []).push(it));
  }
  const order = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  return { order, groups, openTotal: tasks.length };
}

/** Auto-detect projects: any tag containing "project" (+ keeps real progress). */
export function getProjects() {
  const db = getDb();
  const all = db.prepare("SELECT * FROM tasks").all();
  // tags auto-detected from Offload + tags of explicitly-created projects (may have 0 tasks yet)
  const byTag = new Map(); // lower -> {tag, source}
  for (const it of all) for (const t of tagsOf(it.tags)) if (/project/i.test(t)) byTag.set(t.toLowerCase(), { tag: t, source: "auto" });
  for (const p of db.prepare("SELECT name,tag,source FROM projects WHERE status='active'").all()) {
    const tag = p.tag || (/project/i.test(p.name) ? p.name : p.name + " Project");
    if (!byTag.has(tag.toLowerCase())) byTag.set(tag.toLowerCase(), { tag, source: p.source || "manual" });
  }

  const out = [];
  for (const { tag, source } of byTag.values()) {
    const mine = all.filter((it) => tagsOf(it.tags).some((t) => t.toLowerCase() === tag.toLowerCase()));
    const open = mine.filter((it) => it.status === "open");
    const done = mine.filter((it) => it.status !== "open");
    const pct = mine.length ? Math.round((done.length / mine.length) * 100) : 0;
    const recent = [...mine].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
    const next = [...open].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))[0];
    const name = tag.replace(/\s*project\s*$/i, "").trim() || tag;
    out.push({ tag, name, source, pct, open: open.length, total: mine.length,
      last: recent ? recent.text : "—", next: next ? next.text : "All clear",
      tasks: open });
  }
  return out.sort((a, b) => b.open - a.open);
}

const TIERS = [
  { key: "act", label: "Act Now", emoji: "🔴" },
  { key: "review", label: "Review", emoji: "🟡" },
  { key: "quick", label: "Quick Win", emoji: "🟢" },
  { key: "noise", label: "Noise", emoji: "⚪" },
];

export function getInbox() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM emails WHERE handled=0 ORDER BY datetime(received_at) DESC").all();
  const byTier = {};
  for (const t of TIERS) byTier[t.key] = [];
  for (const e of rows) (byTier[e.triage_tier] || byTier.review).push(e);
  const risky = rows.filter((e) => e.risk);
  return { tiers: TIERS, byTier, total: rows.length, risky, counts: Object.fromEntries(TIERS.map((t) => [t.key, byTier[t.key].length])) };
}

/** Open tasks with a due date inside [startISO, endISO) — surfaced on the calendar. */
export function getDueTasks(startDate, endDate) {
  return getDb()
    .prepare("SELECT id,text,tags,due FROM tasks WHERE status='open' AND due IS NOT NULL AND due >= ? AND due < ? ORDER BY due")
    .all(startDate, endDate);
}

/** Recently handled mail (archived/done/spam via the app) — for the show-handled view + Restore. */
export function getHandledInbox(limit = 80) {
  return getDb()
    .prepare("SELECT * FROM emails WHERE handled=1 AND handled_state IN ('archived','done','spam') ORDER BY datetime(updated_at) DESC LIMIT ?")
    .all(limit);
}

export function getStats() {
  const db = getDb();
  const openTasks = db.prepare("SELECT COUNT(*) c FROM tasks WHERE status='open' AND type!='grocery_item'").get().c;
  const inbox = db.prepare("SELECT COUNT(*) c FROM emails WHERE handled=0").get().c;
  const act = db.prepare("SELECT COUNT(*) c FROM emails WHERE handled=0 AND triage_tier='act'").get().c;
  const projects = getProjects().length;
  return { openTasks, inbox, act, projects };
}

/** Most recent cache write (UTC) — for the "synced Xm ago" indicator. */
export function getLastSync() {
  const r = getDb().prepare("SELECT MAX(updated_at) m FROM emails").get();
  return r && r.m ? r.m : null;
}

export function getLatestBriefing() {
  const row = getDb().prepare("SELECT * FROM briefings ORDER BY generated_at DESC LIMIT 1").get();
  if (!row) return null;
  let data = {};
  try { data = JSON.parse(row.content); } catch {}
  return { id: row.id, generated_at: row.generated_at, is_primary: row.is_primary, ...data };
}

/** Lowercased set of tags that already back a project (created or auto-detected). */
export function getProjectTags() {
  return getProjects().map((p) => p.tag.toLowerCase());
}
