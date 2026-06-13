// ===== Phone notification capture =====
// Ingest endpoint for the Android NotificationListener app. Raw notifications land
// here (token-authed at the route layer); Kurt triages them in the dashboard
// widget — dismiss, snooze, or "→ task" (which routes the notification through the
// AI capture layer into Right Now). Per-app filtering happens on the device; this
// is a light server-side backstop against obvious noise.
import { getDb } from "./db.js";
import { addCapture, processCapture } from "./capture.js";
import { askJSON, FAST } from "./claude.js";

const appLabel = (a) => { const s = (a || "").split(".").pop() || "Phone"; return s.charAt(0).toUpperCase() + s.slice(1); };

// Collapse the "X X" doubling some apps emit (e.g. Gmail repeating subject in the
// big-text). If the text is exactly two identical halves, keep one.
function dedupe(s) {
  const t = (s || "").toString().trim().replace(/\s+/g, " ");
  if (!t) return t;
  const w = t.split(" ");
  if (w.length >= 2 && w.length % 2 === 0) {
    const h = w.length / 2;
    if (w.slice(0, h).join(" ") === w.slice(h).join(" ")) return w.slice(0, h).join(" ");
  }
  return t;
}

// Last line of defence if a noisy app slips past the device allow-list.
const NOISE_APPS = ["com.android.systemui", "android", "com.google.android.gms"];
const isNoise = (app, title, body) => {
  const a = (app || "").toLowerCase();
  if (NOISE_APPS.some((n) => a === n)) return true;
  if (!((title || "").trim() || (body || "").trim())) return true; // empty notification
  return false;
};

/** Ingest one notification. Returns {ok, id} or {ok:false, skipped}. */
export function ingestNotification(n = {}) {
  const app = (n.app || n.package || "").toString().slice(0, 120);
  const title = dedupe(n.title).slice(0, 300);
  const body = dedupe(n.body || n.text).slice(0, 2000);
  const link = (n.link || "").toString().slice(0, 1000) || null;
  const posted = (n.posted_at || n.ts || "").toString().slice(0, 40) || null;
  if (isNoise(app, title, body)) return { ok: true, skipped: true };
  const db = getDb();
  // Skip if an identical notification is already waiting (apps re-post the same
  // one on every update — that's the duplicate flood).
  const dup = db.prepare("SELECT 1 FROM notifications WHERE status IN ('new','snoozed') AND app=? AND COALESCE(title,'')=? AND COALESCE(body,'')=? LIMIT 1").get(app, title, body);
  if (dup) return { ok: true, skipped: true };
  const info = db
    .prepare("INSERT INTO notifications (app,title,body,link,posted_at,status) VALUES (?,?,?,?,?,'new')")
    .run(app, title, body, link, posted);
  return { ok: true, id: info.lastInsertRowid };
}

/** Ingest a batch (the device flushes its local queue). Returns counts. */
export function ingestBatch(items = []) {
  let saved = 0, skipped = 0;
  for (const n of items) {
    const r = ingestNotification(n);
    if (r.skipped) skipped++; else if (r.id) saved++;
  }
  return { ok: true, saved, skipped };
}

const ACTIVE = "status IN ('new','snoozed')";
/** Notifications awaiting triage (snoozed ones reappear once their time passes). */
export function listNotifications(limit = 100) {
  return getDb()
    .prepare(`SELECT * FROM notifications WHERE ${ACTIVE} AND (snooze_until IS NULL OR snooze_until <= datetime('now')) ORDER BY id DESC LIMIT ?`)
    .all(limit);
}
export function notifCount() {
  return getDb().prepare(`SELECT COUNT(*) n FROM notifications WHERE ${ACTIVE} AND (snooze_until IS NULL OR snooze_until <= datetime('now'))`).get().n;
}

export function dismissNotification(id) {
  getDb().prepare("UPDATE notifications SET status='dismissed' WHERE id=?").run(id);
  return { ok: true };
}
export function snoozeNotification(id, hours = 3, until = null) {
  if (until) getDb().prepare("UPDATE notifications SET status='snoozed', snooze_until=? WHERE id=?").run(String(until).replace("T", " ").replace(/\.\d+Z$|Z$/, ""), id);
  else getDb().prepare("UPDATE notifications SET status='snoozed', snooze_until=datetime('now', ?) WHERE id=?").run(`+${Number(hours) || 3} hours`, id);
  return { ok: true };
}

/** Flagged notifications that need Kurt's attention (surfaced in Right Now). */
export function listFlaggedNotifications(limit = 10) {
  return getDb()
    .prepare(`SELECT * FROM notifications WHERE flagged=1 AND ${ACTIVE} AND (snooze_until IS NULL OR snooze_until <= datetime('now')) ORDER BY importance DESC, id DESC LIMIT ?`)
    .all(limit);
}

/**
 * AI pass over unanalyzed notifications: tag each, score importance, and flag the
 * ones that genuinely need Kurt (a real person messaging, a time-sensitive alert,
 * money/security, an appointment) — not marketing, reels, or video recs. One
 * batched call per run keeps it cheap.
 */
export async function analyzeNotifications(max = 15) {
  const db = getDb();
  const rows = db.prepare(`SELECT id,app,title,body FROM notifications WHERE COALESCE(analyzed,0)=0 AND ${ACTIVE} ORDER BY id DESC LIMIT ?`).all(max);
  if (!rows.length) return 0;

  const list = rows.map((r, i) => `${i + 1}. [${appLabel(r.app)}] ${(r.title || "").slice(0, 120)} — ${(r.body || "").slice(0, 200)}`).join("\n");
  let arr = [];
  try {
    const out = await askJSON({
      model: FAST,
      system: "You triage Kurt's incoming phone notifications for his ADHD command center. FLAG only what genuinely needs his attention or action: a real person messaging him (especially urgent wording like 'call me'), a time-sensitive alert, money/security/banking, an appointment or delivery that needs a response. Do NOT flag marketing, promos, social reels, video recommendations, or newsletters. Mark obvious junk as spam: scams, phishing, 'you've won' / prize texts, fake bank/delivery alerts with suspicious links, crypto/get-rich pitches, and unsolicited marketing from unknown senders. Spam is noise — never flag it.",
      prompt: `Notifications (app, title — body):\n${list}\n\nReturn ONLY this JSON, one entry per item in the same order:\n{"results":[{"i":1,"category":"message|alert|finance|calendar|delivery|social|promo|media|app|spam|other","importance":<integer 0-100>,"flagged":<true/false>,"spam":<true/false>,"why":"<=8 words on why it matters, or empty>"}]}`,
      max_tokens: 1200,
    });
    arr = Array.isArray(out) ? out : (out.results || out.items || out.notifications || Object.values(out || {}).find(Array.isArray) || []);
  } catch {}

  const upd = db.prepare("UPDATE notifications SET category=?, importance=?, flagged=?, why=?, analyzed=1 WHERE id=?");
  const spamUpd = db.prepare("UPDATE notifications SET category='spam', importance=0, flagged=0, why=?, analyzed=1, status='dismissed' WHERE id=?");
  const mark = db.prepare("UPDATE notifications SET analyzed=1 WHERE id=?");
  rows.forEach((r, idx) => {
    const o = arr.find((x) => Number(x.i) === idx + 1) || arr[idx];
    if (!o) { mark.run(r.id); return; }
    const cat = (o.category || "other").toString().slice(0, 24);
    // Spam is pure noise — tag it and drop it out of the active list entirely.
    if (cat === "spam" || o.spam === true || o.spam === "true") { spamUpd.run((o.why || "spam").toString().slice(0, 80), r.id); return; }
    const imp = Number.isFinite(+o.importance) ? Math.max(0, Math.min(100, Math.round(+o.importance))) : 40;
    const flagged = (o.flagged === true || o.flagged === "true" || imp >= 80) ? 1 : 0;
    upd.run(cat, imp, flagged, (o.why || "").toString().slice(0, 80), r.id);
  });
  return rows.length;
}

/** Promote a notification into the AI capture layer → it appears in Right Now. */
export async function notificationToTask(id) {
  const db = getDb();
  const n = db.prepare("SELECT * FROM notifications WHERE id=?").get(id);
  if (!n) return { ok: false, error: "not found" };
  const parts = [n.app && `[${n.app}]`, n.title, n.body, n.link].filter(Boolean);
  const capId = addCapture(parts.join(" — "), "text");
  if (capId) { try { await processCapture(capId); } catch {} }
  db.prepare("UPDATE notifications SET status='tasked' WHERE id=?").run(id);
  return { ok: true };
}
