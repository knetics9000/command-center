// System-health: surfaces whether each data source is actually flowing, so an
// expired token or a dead phone sync can't make the dashboard lie by omission.
import { getDb } from "./db.js";
import { getMeta } from "./meta.js";
import { connectionStatus } from "./google.js";
import { coparentConnected } from "./coparent.js";

const MIN = 60 * 1000;
const agoMs = (iso) => { if (!iso) return null; const t = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z"); return isNaN(t) ? null : Date.now() - t; };

export function systemStatus() {
  const db = getDb();
  const out = [];

  // Mail — scheduler pulls every 15 min; stale if no successful pull in 40, error if an account failed.
  const mailHb = getMeta("hb_mail");
  const mailErr = getMeta("hb_mail_err");
  const personalConnected = connectionStatus().some((c) => c.connected);
  out.push({
    key: "mail", label: "Mail",
    ago: agoMs(mailHb),
    error: !personalConnected ? "not connected" : (mailErr || null),
    stale: personalConnected && (!mailHb || agoMs(mailHb) > 40 * MIN),
    off: !personalConnected,
  });

  // Kids co-parent inbox.
  const kidsHb = getMeta("hb_kids");
  const kidsOn = coparentConnected();
  out.push({
    key: "kids", label: "Kids",
    ago: agoMs(kidsHb),
    error: null,
    stale: kidsOn && (!kidsHb || agoMs(kidsHb) > 40 * MIN),
    off: !kidsOn,
  });

  // Phone notifications — the device pushes, so quiet is normal; show last received, never red.
  const lastNotif = db.prepare("SELECT MAX(created_at) m FROM notifications").get().m;
  out.push({ key: "phone", label: "Phone", ago: agoMs(lastNotif), error: null, stale: false, off: !lastNotif });

  // Offload thoughts — pulled on the same cadence as Mail/Kids.
  const thoughtsHb = getMeta("hb_thoughts");
  const thoughtsOn = !!process.env.OFFLOAD_URL && !!process.env.OFFLOAD_TOKEN;
  out.push({
    key: "thoughts", label: "Thoughts",
    ago: agoMs(thoughtsHb), error: null,
    stale: thoughtsOn && (!thoughtsHb || agoMs(thoughtsHb) > 40 * MIN),
    off: !thoughtsOn,
  });

  // Health — 3h cache; stale if connected but nothing in 8h.
  let healthCache = {};
  try { healthCache = JSON.parse(getMeta("health_cache") || "{}"); } catch {}
  const healthOn = !!(healthCache && healthCache.connected);
  out.push({
    key: "health", label: "Health",
    ago: agoMs(healthCache.fetchedAt),
    error: null,
    stale: healthOn && (!healthCache.fetchedAt || agoMs(healthCache.fetchedAt) > 8 * 60 * MIN),
    off: !healthOn,
  });

  return out;
}
