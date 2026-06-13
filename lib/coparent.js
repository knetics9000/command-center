// ===== Co-parent inbox (kmriedel0214@gmail.com) =====
// Shared kid-logistics account. Every email gets an AI read: which kid it's
// about, and whether Kurt actually needs to know (school, medical, schedule,
// custody, money, deadlines) vs. routine noise. Important ones surface in the
// Kids widget bucketed per kid; noise stays counted but out of the way.
import { getDb } from "./db.js";
import { listInbox, getTokenRow } from "./google.js";
import { askJSON, FAST } from "./claude.js";
import { setMeta } from "./meta.js";

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
      system: `You triage the co-parenting inbox Kurt shares with his ex-wife. It funnels info about their kids: ${KIDS_FULL.join(", ")}. (Note: the son Kurt shares his father's name.) IMPORTANT = things dad must know or act on: school (grades, teachers, events, forms), school meeting/event invitations and info nights, medical/dental APPOINTMENT REMINDERS and confirmations, schedule or custody changes, activities/sports signups and logistics, money for the kids, deadlines, anything from the ex-wife herself about the kids. NOT important = newsletters, promos, store marketing (beware: brands like "Nova's Collection" are STORES, not the kids), app notifications, routine security/privacy notices, receipts of no consequence, spam.`,
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
     ON CONFLICT(id) DO UPDATE SET subject=excluded.subject, snippet=excluded.snippet, received_at=excluded.received_at, updated_at=datetime('now')`
  );
  const tx = db.transaction(() => {
    for (const m of msgs) {
      const s = parseSender(m.sender);
      ins.run({ id: m.id, thread_id: m.threadId, sender: s.name, sender_addr: s.addr, subject: m.subject, snippet: m.snippet, received_at: m.ts ? new Date(m.ts).toISOString() : m.date });
    }
  });
  tx();
  const analyzed = await classifyCoparent(20);
  setMeta("hb_kids", new Date().toISOString());
  return { connected: true, pulled: msgs.length, analyzed };
}

/** Widget payload: per-kid buckets ("All" emails appear in every bucket). */
export function kidsBoard() {
  if (!coparentConnected()) return { connected: false, kids: [], noise: 0, toReview: 0 };
  const db = getDb();
  const rows = db.prepare("SELECT * FROM coparent_emails WHERE analyzed=1 AND (snooze_until IS NULL OR datetime(snooze_until) <= datetime('now')) ORDER BY datetime(received_at) DESC LIMIT 300").all();
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
    // last 2 weeks of filtered-out emails, so misclassifications are catchable
    routine: rows.filter((r) => r.important === 0).slice(0, 20)
      .map((r) => ({ id: r.id, kid: r.kid, sender: r.sender, subject: r.subject, received_at: r.received_at })),
    toReview: rows.filter((r) => r.important === 1 && r.seen === 0).length,
  };
}

/** Kurt overrides the AI: this filtered email IS important — surface it. */
export function promoteKidEmail(id) {
  getDb().prepare("UPDATE coparent_emails SET important=1, seen=0, why=COALESCE(NULLIF(why,''),'Flagged by Kurt'), updated_at=datetime('now') WHERE id=?").run(id);
}

export function markKidSeen(id, seen = 1) {
  getDb().prepare("UPDATE coparent_emails SET seen=?, updated_at=datetime('now') WHERE id=?").run(seen ? 1 : 0, id);
}
/** Hide a kid email until `until` (auto-returns to its bucket after). */
export function snoozeKidEmail(id, until) {
  const ts = String(until || "").replace("T", " ").replace(/\.\d+Z$|Z$/, "");
  getDb().prepare("UPDATE coparent_emails SET snooze_until=?, updated_at=datetime('now') WHERE id=?").run(ts, id);
}

// ---- Calendar + bulk-dismiss actions ----
import { getBody, createEvent } from "./google.js";

/** AI-extract an event draft from email text. Exported for testing. */
export async function kidEventDraftFromText({ subject, body, kid, received }) {
  const today = new Date().toISOString().slice(0, 10);
  const recv = (received || "").slice(0, 10);
  const out = await askJSON({
    model: FAST,
    system: `You extract a single calendar event from a school/kids email. Today is ${today} (America/New_York).${recv ? ` The email was RECEIVED on ${recv} — resolve relative or yearless dates ("May 20", "tomorrow", "this Thursday") against that received date, NOT today.` : ""}`,
    prompt: `Subject: ${subject}\n\n${(body || "").slice(0, 3000)}\n\nReturn ONE JSON object:\n{"found":<true only if the email contains an explicit date or day for an event/deadline>,"summary":"short event title","location":"or ''","start":"YYYY-MM-DDTHH:MM","allDay":<true if no specific time>,"durationMin":60}\nIf the date already passed, still return it with the real date. Return ONLY the object.`,
    max_tokens: 300,
  });
  if (!out || out.found !== true || !out.start) return null;
  const prefix = kid && kid !== "All" ? kid + " — " : "Kids — ";
  return {
    summary: prefix + (out.summary || subject || "Event").slice(0, 100),
    location: out.location || "",
    start: out.start,
    allDay: out.allDay === true || !/T\d{2}:\d{2}/.test(out.start),
    durationMin: Number(out.durationMin) || 60,
  };
}

/** One-click: email → AI event → Google Calendar (Kurt's personal). Marks the item seen. */
export async function kidToCalendar(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM coparent_emails WHERE id=?").get(id);
  if (!row) return { ok: false, error: "not found" };
  let body = row.snippet || "";
  try { body = (await getBody("coparent", id)) || body; } catch {}
  const draft = await kidEventDraftFromText({ subject: row.subject, body, kid: row.kid, received: row.received_at });
  if (!draft) return { ok: false, error: "No clear date found in this email" };
  // Stale-backlog guard: don't litter the calendar with events that already happened.
  if (draft.start.slice(0, 10) < new Date().toLocaleDateString("en-CA"))
    return { ok: false, error: `That date already passed (${draft.start.slice(0, 10)}) — dismiss it instead` };
  const end = draft.allDay ? null : new Date(new Date(draft.start).getTime() + draft.durationMin * 60000)
    .toLocaleString("sv-SE").replace(" ", "T").slice(0, 16);
  const ev = await createEvent("personal", {
    summary: draft.summary, location: draft.location, description: "From co-parent inbox: " + (row.subject || ""),
    start: draft.start, end, allDay: draft.allDay,
  });
  markKidSeen(id, 1);
  return { ok: true, summary: draft.summary, start: draft.start, allDay: draft.allDay, eventId: ev.id };
}

/** Bulk dismiss: one kid's bucket, or everything currently surfaced. */
export function markAllKidSeen(kid = null) {
  const db = getDb();
  const r = kid
    ? db.prepare("UPDATE coparent_emails SET seen=1, updated_at=datetime('now') WHERE important=1 AND seen=0 AND (kid=? OR kid='All')").run(kid)
    : db.prepare("UPDATE coparent_emails SET seen=1, updated_at=datetime('now') WHERE important=1 AND seen=0").run();
  return r.changes;
}
