// Relationship engine: given any item (a briefing priority, theme, project,
// contact, email), find related records across the cached data — emails, tasks,
// projects, calendar events, and contacts (derived from senders). Optional
// Haiku layer explains why it surfaced and suggests actions. One engine powers
// every drill-down drawer in the dashboard.
import { getDb } from "./db.js";
import { askJSON, FAST } from "./claude.js";

const STOP = new Set(
  "the a an and or of to for in on at with your you my me is are was be this that new from re fwd will need it as by we us our about into".split(" ")
);

/** Extract up to N meaningful search terms from a title (+ explicit keywords). */
export function terms(input, extra = []) {
  const words = (input || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  const set = new Set();
  for (const w of [...words, ...extra.map((x) => String(x).toLowerCase())]) {
    if (w.length >= 3 && !STOP.has(w)) set.add(w);
  }
  return [...set].slice(0, 7);
}

function likeClause(cols, ts) {
  const parts = [], params = [];
  for (const t of ts) {
    parts.push("(" + cols.map((c) => `${c} LIKE ?`).join(" OR ") + ")");
    for (let i = 0; i < cols.length; i++) params.push("%" + t + "%");
  }
  return { clause: parts.length ? parts.join(" OR ") : "0", params };
}
const score = (txt, ts) => { const l = (txt || "").toLowerCase(); return ts.reduce((n, t) => n + (l.includes(t) ? 1 : 0), 0); };

export function relatedFor({ title = "", keywords = [], projectTag = "", excludeEmailId = "", limit = 8 } = {}) {
  const db = getDb();
  const ts = terms(title + " " + projectTag, keywords);
  if (!ts.length) return { emails: [], tasks: [], projects: [], events: [], contacts: [], terms: [] };

  const ec = likeClause(["subject", "sender", "snippet"], ts);
  let emails = db.prepare(
    `SELECT id,account,sender,sender_addr,subject,snippet,triage_tier,received_at,handled
     FROM emails WHERE (${ec.clause}) ${excludeEmailId ? "AND id!=?" : ""}
     ORDER BY datetime(received_at) DESC LIMIT 40`
  ).all(...ec.params, ...(excludeEmailId ? [excludeEmailId] : []));
  emails = emails
    .map((e) => ({ ...e, _s: score(e.subject + " " + e.sender + " " + e.snippet, ts) }))
    .sort((a, b) => b._s - a._s || (b.received_at || "").localeCompare(a.received_at || ""))
    .slice(0, limit);

  const tc = likeClause(["text", "tags"], ts);
  const tasks = db.prepare(`SELECT id,text,tags,status,due FROM tasks WHERE (${tc.clause}) AND status='open' LIMIT ${limit}`).all(...tc.params);

  const pc = likeClause(["name", "tag", "notes"], ts);
  const projRows = db.prepare(`SELECT name,tag FROM projects WHERE (${pc.clause}) LIMIT ${limit}`).all(...pc.params);
  // also surface auto-detected project tags (from tasks) whose name matches a term
  const tagHits = new Set(projRows.map((p) => p.tag.toLowerCase()));
  for (const r of db.prepare("SELECT DISTINCT tags FROM tasks WHERE tags LIKE '%roject%'").all()) {
    for (const t of (r.tags || "").split(";").map((x) => x.trim())) {
      if (/project/i.test(t) && score(t, ts) > 0 && !tagHits.has(t.toLowerCase())) {
        tagHits.add(t.toLowerCase());
        projRows.push({ name: t.replace(/\s*project\s*$/i, "").trim() || t, tag: t });
      }
    }
  }
  const projects = projRows.slice(0, limit);

  const cc = likeClause(["title", "location"], ts);
  const events = db.prepare(`SELECT title,location,start FROM calendar_events WHERE (${cc.clause}) ORDER BY datetime(start) DESC LIMIT ${limit}`).all(...cc.params);

  const cmap = new Map();
  for (const e of emails) {
    const k = e.sender_addr || e.sender; if (!k) continue;
    if (!cmap.has(k)) cmap.set(k, { name: e.sender, addr: e.sender_addr, count: 0 });
    cmap.get(k).count++;
  }
  const contacts = [...cmap.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  return { emails, tasks, projects, events, contacts, terms: ts };
}

/** Haiku: why this item matters now + 2-4 suggested actions. */
export async function aiContext(title, rel) {
  const summary = {
    emails: rel.emails.slice(0, 6).map((e) => ({ from: e.sender, subject: e.subject })),
    tasks: rel.tasks.slice(0, 6).map((t) => t.text),
    projects: rel.projects.map((p) => p.name),
    contacts: rel.contacts.slice(0, 4).map((c) => c.name),
  };
  try {
    const d = await askJSON({
      model: FAST,
      system: "You explain why a dashboard item was surfaced for Kurt and suggest next actions. Concrete, specific, brief.",
      prompt: `Item: "${title}"\nRelated data:\n${JSON.stringify(summary)}\n\nReturn ONE JSON object: {"why":"<=30 words on why this matters now","actions":["<=8 words imperative", ...2-4 items]}. Return only JSON.`,
      max_tokens: 300,
    });
    return { why: d.why || "", actions: Array.isArray(d.actions) ? d.actions.slice(0, 4) : [] };
  } catch { return null; }
}
