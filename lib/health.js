import { google } from "googleapis";
import { getDb } from "./db.js";
import { getMeta, setMeta } from "./meta.js";

// Google Health API (v4) — Fitbit data migrated here. Separate OAuth from Gmail/Calendar.
const SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
];
const REDIRECT = (process.env.APP_BASE_URL || "http://localhost:3000") + "/api/health/callback";
const oauth = () => new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, REDIRECT);

export function healthAuthUrl() {
  return oauth().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
}
export async function saveHealthToken(code) {
  const { tokens } = await oauth().getToken(code);
  getDb().prepare(
    `INSERT INTO google_tokens (account,access_token,refresh_token,expiry,scope,updated_at) VALUES ('health',?,?,?,?,datetime('now'))
     ON CONFLICT(account) DO UPDATE SET access_token=excluded.access_token, refresh_token=COALESCE(excluded.refresh_token,google_tokens.refresh_token), expiry=excluded.expiry, scope=excluded.scope, updated_at=datetime('now')`
  ).run(tokens.access_token || "", tokens.refresh_token || null, tokens.expiry_date || null, tokens.scope || "");
}
export function healthConnected() {
  const r = getDb().prepare("SELECT refresh_token FROM google_tokens WHERE account='health'").get();
  return !!(r && r.refresh_token);
}
async function authed() {
  const r = getDb().prepare("SELECT * FROM google_tokens WHERE account='health'").get();
  if (!r || !r.refresh_token) return null;
  const o = oauth();
  o.setCredentials({ refresh_token: r.refresh_token, access_token: r.access_token, expiry_date: r.expiry });
  return o;
}

// pull a number out of a roll-up data point regardless of the exact union field name
function leafNumber(dp) {
  for (const [k, v] of Object.entries(dp || {})) {
    if (k === "civilStartTime" || k === "civilEndTime") continue;
    if (v && typeof v === "object") { for (const vv of Object.values(v)) { const n = Number(vv); if (Number.isFinite(n)) return n; } }
    const n = Number(v); if (Number.isFinite(n)) return n;
  }
  return null;
}

async function rollup(o, dataType, days = 2) {
  const today = new Date(); const start = new Date(today); start.setDate(today.getDate() - (days - 1));
  const ymd = (d) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
  const token = (await o.getAccessToken()).token;
  const res = await fetch(`https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range: { start: ymd(start), end: ymd(today) }, windowSizeDays: 1, pageSize: 14, dataSourceFamily: "users/me/dataSourceFamilies/all-sources" }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${dataType} ${res.status}`);
  const j = await res.json();
  const pts = j.rollupDataPoints || [];
  return pts.length ? leafNumber(pts[pts.length - 1]) : null;
}

/** Live fetch of today's health snapshot from the Google Health API. */
export async function refreshHealth() {
  const o = await authed();
  if (!o) return { connected: false };
  const out = { connected: true, fetchedAt: new Date().toISOString() };
  const tryGet = async (key, type, days, xform) => { try { const v = await rollup(o, type, days); out[key] = v == null ? null : (xform ? xform(v) : v); } catch (e) { out[key] = null; } };
  await tryGet("steps", "steps", 1);
  await tryGet("restingHr", "dailyRestingHeartRate", 2);
  await tryGet("activeMinutes", "activeZoneMinutes", 1);
  await tryGet("sleepHours", "sleep", 2, (v) => (v > 3600 ? +(v / 3600).toFixed(1) : v > 60 ? +(v / 60).toFixed(1) : v)); // seconds or minutes -> hours
  setMeta("health_cache", JSON.stringify(out));
  return out;
}

/** Raw diagnostic: shows the HTTP status + body for each data type call. */
export async function debugHealth() {
  const o = await authed();
  if (!o) return { connected: false };
  const today = new Date(); const start = new Date(today); start.setDate(today.getDate() - 3);
  const ymd = (d) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
  let token = "";
  try { token = (await o.getAccessToken()).token; } catch (e) { return { connected: true, tokenError: e.message }; }
  const out = { connected: true };
  for (const t of ["steps", "dailyRestingHeartRate", "activeZoneMinutes", "sleep"]) {
    try {
      const res = await fetch(`https://health.googleapis.com/v4/users/me/dataTypes/${t}/dataPoints:dailyRollUp`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ range: { start: ymd(start), end: ymd(today) }, windowSizeDays: 1, pageSize: 14, dataSourceFamily: "users/me/dataSourceFamilies/all-sources" }),
        signal: AbortSignal.timeout(12000),
      });
      out[t] = { status: res.status, body: (await res.text()).slice(0, 700) };
    } catch (e) { out[t] = { error: e.message }; }
  }
  return out;
}

/** Cached snapshot (instant load); refreshes if stale or forced. */
export async function getHealth({ force = false } = {}) {
  if (!healthConnected()) return { connected: false };
  let cache = {}; try { cache = JSON.parse(getMeta("health_cache") || "{}"); } catch {}
  const stale = !cache.fetchedAt || (Date.now() - new Date(cache.fetchedAt).getTime()) > 3 * 3600e3;
  if (force || stale) { try { return await refreshHealth(); } catch { return { connected: true, ...cache, error: true }; } }
  return { connected: true, ...cache };
}
