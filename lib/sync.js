// Pull Gmail (both accounts) + Offload into SQLite. Cron + manual refresh call these.
import { getDb } from "./db.js";
import { listInbox } from "./google.js";
import { pullOffload } from "./offload.js";
import { triageEmails } from "./triage.js";

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function parseSender(raw) {
  raw = raw || ""; const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  let name = "", addr = raw.trim();
  if (m) { name = m[1].trim(); addr = m[2].trim(); }
  if (!name) name = (addr.split("@")[0] || addr).replace(/[._+-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { name, addr: addr.toLowerCase() };
}

/** Offload -> tasks table (sheet is source of truth; keep locally-added unsynced rows). */
export async function syncTasks() {
  const rows = await pullOffload();
  const db = getDb();
  const ins = db.prepare(
    `INSERT OR REPLACE INTO tasks (id,text,tags,type,status,source,created_at,synced,updated_at)
     VALUES (?,?,?,?,?,'offload',?,1,datetime('now'))`
  );
  const pulledTexts = new Set(rows.map((r) => r.text));
  // preserve in-app due dates across the wipe/re-insert (Offload has no due field)
  const dueById = new Map(db.prepare("SELECT id,due FROM tasks WHERE due IS NOT NULL").all().map((r) => [r.id, r.due]));
  const setDue = db.prepare("UPDATE tasks SET due=? WHERE id=?");
  const tx = db.transaction((rows) => {
    db.prepare("DELETE FROM tasks WHERE synced=1").run();
    for (const r of rows) {
      const id = r.id || "u_" + hash(r.text + r.created);
      ins.run(id, r.text, r.tags, r.type || "task", r.status || "open", r.created);
      if (dueById.has(id)) setDue.run(dueById.get(id), id);
    }
    // clear optimistic local rows now superseded by their real Offload counterpart
    for (const t of pulledTexts) db.prepare("DELETE FROM tasks WHERE synced=0 AND text=?").run(t);
  });
  tx(rows);
  return rows.length;
}

/** Gmail both accounts -> emails table; triage only new; mark vanished mail handled. */
/** Return snoozed emails to the board once their time has passed. */
export function unsnoozeDue() {
  return getDb()
    .prepare("UPDATE emails SET handled=0, handled_state=NULL, snooze_until=NULL, updated_at=datetime('now') WHERE handled_state='snoozed' AND snooze_until IS NOT NULL AND datetime(snooze_until) <= datetime('now')")
    .run().changes;
}

export async function syncInbox() {
  const db = getDb();
  const woke = unsnoozeDue();
  if (woke) console.log(`unsnoozed ${woke} email(s)`);
  let all = [], failed = [];
  for (const acc of ["personal", "work"]) {
    try { all = all.concat(await listInbox(acc, 120)); } catch (e) { failed.push(acc); }
  }
  const existing = new Set(db.prepare("SELECT id FROM emails").all().map((r) => r.id));
  const toTriage = all.filter((m) => !existing.has(m.id));
  const tmap = toTriage.length
    ? await triageEmails(toTriage.map((m) => ({ id: m.id, account: m.account, sender: m.sender, subject: m.subject, snippet: m.snippet })))
    : {};

  const ins = db.prepare(
    `INSERT INTO emails (id,account,thread_id,sender,sender_addr,subject,snippet,received_at,triage_tier,why,action,risk,risk_why,category,handled,handled_state,updated_at)
     VALUES (@id,@account,@thread_id,@sender,@sender_addr,@subject,@snippet,@received_at,@triage_tier,@why,@action,@risk,@risk_why,@category,0,NULL,datetime('now'))
     ON CONFLICT(id) DO UPDATE SET subject=excluded.subject, snippet=excluded.snippet, received_at=excluded.received_at, updated_at=datetime('now')`
  );
  const inboxIds = all.map((m) => m.id);
  const tx = db.transaction(() => {
    for (const m of all) {
      const t = tmap[m.id] || {}; const s = parseSender(m.sender);
      ins.run({
        id: m.id, account: m.account, thread_id: m.threadId, sender: s.name, sender_addr: s.addr,
        subject: m.subject, snippet: m.snippet, received_at: m.date,
        triage_tier: t.tier || null, why: t.why || null, action: t.action || null,
        risk: t.risk || 0, risk_why: t.riskWhy || null,
      });
    }
    // anything no longer in the live inbox (handled elsewhere) -> drop from the board
    if (inboxIds.length) {
      const ph = inboxIds.map(() => "?").join(",");
      db.prepare(`UPDATE emails SET handled=1, handled_state=COALESCE(handled_state,'gone') WHERE handled=0 AND id NOT IN (${ph})`).run(...inboxIds);
    }
  });
  tx();
  return { pulled: all.length, triaged: toTriage.length, failed };
}

export async function syncAll() {
  const [tasks, inbox] = await Promise.allSettled([syncTasks(), syncInbox()]);
  return {
    tasks: tasks.status === "fulfilled" ? tasks.value : null,
    inbox: inbox.status === "fulfilled" ? inbox.value : null,
    errors: [tasks, inbox].filter((r) => r.status === "rejected").map((r) => String(r.reason)),
  };
}
