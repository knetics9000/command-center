// Read helpers for the dashboard (all from SQLite cache).
import { getDb } from "./db.js";
import { tagsOf, tagClass } from "./tags.js";
import { feedbackMap, effectivePriority } from "./priority.js";
import { BUCKETS, BUCKET_COLOR } from "./buckets.js";
export { tagsOf, tagClass };

/** The 6 life-category buckets with live counts of what they collect. */
export function getBucketSummary() {
  const db = getDb();
  return BUCKETS.map((b) => {
    const emails = db.prepare("SELECT COUNT(*) c FROM emails WHERE handled=0 AND category=?").get(b).c;
    const tasks = db.prepare("SELECT COUNT(*) c FROM tasks WHERE status='open' AND lower(tags) LIKE '%'||lower(?)||'%'").get(b).c;
    return { name: b, color: BUCKET_COLOR[b] || "#777", emails, tasks };
  });
}

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
    // health: days since last task activity + overdue + progress
    const lastTs = mine.map((it) => it.updated_at || it.created_at || "").sort().slice(-1)[0] || "";
    const daysSince = lastTs ? Math.floor((Date.now() - new Date(lastTs.replace(" ", "T") + "Z").getTime()) / 86400e3) : 999;
    const todayStr = new Date().toLocaleDateString("en-CA");
    const overdue = open.filter((it) => it.due && it.due < todayStr).length;
    const stalled = open.length > 0 && daysSince >= 7;
    let health = "green";
    if (mine.length === 0) health = "green";
    else if (stalled || overdue >= 3) health = "red";
    else if (daysSince >= 4 || overdue >= 1 || (open.length > 0 && pct < 20)) health = "yellow";
    out.push({ tag, name, source, pct, open: open.length, total: mine.length,
      last: recent ? recent.text : "—", next: next ? next.text : "All clear",
      tasks: open, health, stalled, daysSince: mine.length ? daysSince : 0, overdue });
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
  const fb = feedbackMap();
  const rows = db.prepare("SELECT * FROM emails WHERE handled=0 ORDER BY datetime(received_at) DESC").all()
    .map((e) => { const ep = effectivePriority(e, fb); return { ...e, prio: ep.p, prioWhy: ep.why, prioExplicit: ep.explicit ? 1 : 0 }; });
  const byTier = {};
  for (const t of TIERS) byTier[t.key] = [];
  for (const e of rows) (byTier[e.triage_tier] || byTier.review).push(e);
  const risky = rows.filter((e) => e.risk);
  return { tiers: TIERS, byTier, total: rows.length, risky, priorityCount: rows.filter((e) => e.prio === 1).length };
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
  const doneTasks = db.prepare("SELECT COUNT(*) c FROM tasks WHERE status!='open' AND type!='grocery_item'").get().c;
  const inbox = db.prepare("SELECT COUNT(*) c FROM emails WHERE handled=0").get().c;
  const act = db.prepare("SELECT COUNT(*) c FROM emails WHERE handled=0 AND triage_tier='act'").get().c;
  const projList = getProjects();
  const avgProj = projList.length ? Math.round(projList.reduce((s, p) => s + p.pct, 0) / projList.length) : 0;
  return { openTasks, doneTasks, inbox, act, projects: projList.length, avgProj };
}

/** Most recent cache write (UTC) — for the "synced Xm ago" indicator. */
export function getLastSync() {
  const r = getDb().prepare("SELECT MAX(updated_at) m FROM emails").get();
  return r && r.m ? r.m : null;
}

export function getRecentContacts(limit = 6) {
  return getDb().prepare(
    "SELECT sender, sender_addr, MAX(received_at) recent, COUNT(*) n FROM emails WHERE handled=0 AND sender_addr IS NOT NULL AND sender_addr != '' GROUP BY lower(sender_addr) ORDER BY datetime(recent) DESC LIMIT ?"
  ).all(limit);
}
export function getSplit() {
  const db = getDb();
  const q = (sql, ...a) => db.prepare(sql).get(...a).c;
  return {
    emailWork: q("SELECT COUNT(*) c FROM emails WHERE handled=0 AND account='work'"),
    emailPersonal: q("SELECT COUNT(*) c FROM emails WHERE handled=0 AND account='personal'"),
    taskWork: q("SELECT COUNT(*) c FROM tasks WHERE status='open' AND lower(tags) LIKE '%work%'"),
    taskPersonal: q("SELECT COUNT(*) c FROM tasks WHERE status='open' AND lower(tags) LIKE '%personal%'"),
  };
}
export function getClearedSummary() {
  const db = getDb();
  return {
    emails: db.prepare("SELECT COUNT(*) c FROM emails WHERE handled=1 AND handled_state IN ('archived','done','spam')").get().c,
    tasks: db.prepare("SELECT COUNT(*) c FROM tasks WHERE status!='open' AND type!='grocery_item'").get().c,
  };
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
