// ===== Co-parent inbox (kmriedel0214@gmail.com) =====
// Shared kid-logistics account. Every email gets an AI read: which kid it's
// about, and whether Kurt actually needs to know (school, medical, schedule,
// custody, money, deadlines) vs. routine noise. Important ones surface in the
// Kids widget bucketed per kid; noise stays counted but out of the way.
import { getDb } from "./db.js";
import { listInbox, getTokenRow } from "./google.js";
import { askJSON, FAST } from "./claude.js";

export const KIDS_FULL = (process.env.KIDS_NAMES || "Kurt Riedel, Nova Riedel, Jayden Harvey")
  .split(",").map((s) => s.trim()).filter(Boolean);
export const KIDS = KIDS_FULL.map((n) => n.split(" ")[0]);   // bucket keys: first names

export const coparentConnected = () => { const r = getTokenRow("coparent"); return !!(r && r.refresh_token); };

const parseSender = (s) => {
  const m = /^(.*?)\s*<(.+?)>\s*$/.exec(s || "");
  return m ? { name: m[1].replace(/^"|"$/g, "") || m[2], addr: m[2].toLowerCase() } : { name: s || "", addr: (s || "").toLowerCase() };
};

/** One batched AI pass over unanalyzed co-parent emails. */
export async function classifyCoparent(max = 20) {
  const db = getDb();
  const rows = db.prepare("SELECT id,sender,subject,snippet FROM coparent_emails WHERE analyzed=0 ORDER BY received_at DESC LIMIT ?").all(max);
  if (!rows.length) return 0;
  const list = rows.map((r, i) => `${i + 1}. From: ${r.sender} | Subject: ${r.subject} | ${(r.snippet || "").slice(0, 180)}`).join("\n");
  let arr = [];
  try {
    const out = await askJSON({
      model: FAST,
      system: `You triage the co-parenting inbox Kurt shares with his ex-wife. It funnels info about their kids: ${KIDS_FULL.join(", ")}. (Note: the son Kurt shares his father's name.) IMPORTANT = things dad must know or act on: school (grades, teachers, events, forms), medical/dental, schedule or custody changes, activities/sports logistics, money for the kids, deadlines, anything from the ex-wife herself about the kids. NOT important = newsletters, promos, app notifications, receipts of no consequence, spam.`,
      prompt: `Emails:\n${list}\n\nReturn ONLY this JSON, one entry per email in order:\n{"results":[{"i":1,"kid":"${KIDS.join("|")}|All","important":<true/false>,"why":"<=10 words why dad should know, or empty","action":"<=8 words next step, or empty"}]}\nUse "All" when it concerns multiple kids or general co-parent logistics.`,
      max_tokens: 1400,
    });
    arr = Array.isArray(out) ? out : (out.results || Object.values(out || {}).find(Array.isArray) || []);
  } catch {}
  const upd = db.prepare("UPDATE coparent_emails SET kid=?, important=?, why=?, action=?, analyzed=1, updated_at=datetime('now') WHERE id=?");
  const mark = db.prepare("UPDATE coparent_emails SET analyzed=1 WHERE id=?");
  rows.forEach((r, idx) => {
    const o = arr.find((x) => Number(x.i) === idx + 1) || arr[idx];
    if (!o) { mark.run(r.id); return; }
    const kid = KIDS.includes(o.kid) ? o.kid : "All";
    const imp = (o.important === true || o.important === "true") ? 1 : 0;
    upd.run(kid, imp, (o.why || "").toString().slice(0, 100), (o.action || "").toString().slice(0, 80), r.id);
  });
  return rows.length;
}

/** Pull the co-parent inbox and classify anything new. Safe no-op if not connected. */
export async function syncCoparent() {
  if (!coparentConnected()) return { connected: false };
  const db = getDb();
  const msgs = await listInbox("coparent", 80);
  const ins = db.prepare(
    `INSERT INTO coparent_emails (id,thread_id,sender,sender_addr,subject,snippet,received_at)
     VALUES (@id,@thread_id,@sender,@sender_addr,@subject,@snippet,@received_at)
     ON CONFLICT(id) DO UPDATE SET subject=excluded.subject, snippet=excluded.snippet, updated_at=datetime('now')`
  );
  const tx = db.transaction(() => {
    for (const m of msgs) {
      const s = parseSender(m.sender);
      ins.run({ id: m.id, thread_id: m.threadId, sender: s.name, sender_addr: s.addr, subject: m.subject, snippet: m.snippet, received_at: m.date });
    }
  });
  tx();
  const analyzed = await classifyCoparent(20);
  return { connected: true, pulled: msgs.length, analyzed };
}

/** Widget payload: per-kid buckets ("All" emails appear in every bucket). */
export function kidsBoard() {
  if (!coparentConnected()) return { connected: false, kids: [], noise: 0, toReview: 0 };
  const db = getDb();
  const rows = db.prepare("SELECT * FROM coparent_emails WHERE analyzed=1 ORDER BY received_at DESC LIMIT 300").all();
  const kids = KIDS.map((name) => {
    const mine = rows.filter((r) => r.kid === name || r.kid === "All");
    return {
      name,
      items: mine.filter((r) => r.important === 1 && r.seen === 0).slice(0, 10),
      seenCount: mine.filter((r) => r.important === 1 && r.seen === 1).length,
    };
  });
  return {
    connected: true,
    kids,
    noise: rows.filter((r) => r.important === 0).length,
    toReview: rows.filter((r) => r.important === 1 && r.seen === 0).length,
  };
}

export function markKidSeen(id, seen = 1) {
  getDb().prepare("UPDATE coparent_emails SET seen=?, updated_at=datetime('now') WHERE id=?").run(seen ? 1 : 0, id);
}
