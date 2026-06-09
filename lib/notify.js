// ===== Phone notification capture =====
// Ingest endpoint for the Android NotificationListener app. Raw notifications land
// here (token-authed at the route layer); Kurt triages them in the dashboard
// widget — dismiss, snooze, or "→ task" (which routes the notification through the
// AI capture layer into Right Now). Per-app filtering happens on the device; this
// is a light server-side backstop against obvious noise.
import { getDb } from "./db.js";
import { addCapture, processCapture } from "./capture.js";

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
  const title = (n.title || "").toString().slice(0, 300);
  const body = (n.body || n.text || "").toString().slice(0, 2000);
  const link = (n.link || "").toString().slice(0, 1000) || null;
  const posted = (n.posted_at || n.ts || "").toString().slice(0, 40) || null;
  if (isNoise(app, title, body)) return { ok: true, skipped: true };
  const info = getDb()
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
export function snoozeNotification(id, hours = 3) {
  getDb().prepare("UPDATE notifications SET status='snoozed', snooze_until=datetime('now', ?) WHERE id=?").run(`+${Number(hours) || 3} hours`, id);
  return { ok: true };
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
