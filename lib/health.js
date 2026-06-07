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

// all numeric leaves inside a value object (handles nested rollup shapes)
function deepNumbers(v, acc = []) {
  if (v && typeof v === "object") { for (const vv of Object.values(v)) deepNumbers(vv, acc); }
  else { const n = Number(v); if (Number.isFinite(n)) acc.push(n); }
  return acc;
}
function dataNumber(dp, mode = "first") {
  const data = {}; for (const [k, v] of Object.entries(dp || {})) if (k !== "civilStartTime" && k !== "civilEndTime") data[k] = v;
  const nums = deepNumbers(data);
  if (!nums.length) return null;
  if (mode === "sum") return Math.round(nums.reduce((a, b) => a + b, 0));
  if (mode === "max") return Math.max(...nums);
  return nums[0];
}
// CivilDateTime = { date:{year,month,day}, time:{hours,minutes,seconds} }; closed-open range.
const civil = (d) => ({ date: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }, time: { hours: 0, minutes: 0, seconds: 0 } });
function civilRange(days) {
  const end = new Date(); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1); // exclusive end = tomorrow 00:00
  const start = new Date(end); start.setDate(end.getDate() - days);
  return { start: civil(start), end: civil(end) };
}

async function rollup(o, dataType, days = 1, mode = "first") {
  const token = (await o.getAccessToken()).token;
  const res = await fetch(`https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range: civilRange(days), windowSizeDays: 1, pageSize: 14, dataSourceFamily: "users/me/dataSourceFamilies/all-sources" }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${dataType} ${res.status}`);
  const j = await res.json();
  const pts = j.rollupDataPoints || [];
  return pts.length ? dataNumber(pts[pts.length - 1], mode) : null;
}

// list endpoint (for types that don't support dailyRollUp) — returns points newest-first
async function listPoints(o, id, pageSize = 1) {
  const token = (await o.getAccessToken()).token;
  const res = await fetch(`https://health.googleapis.com/v4/users/me/dataTypes/${id}/dataPoints?pageSize=${pageSize}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${id} list ${res.status}`);
  return (await res.json()).dataPoints || [];
}
function findKey(o, key) {
  if (!o || typeof o !== "object") return null;
  if (key in o && Number.isFinite(Number(o[key]))) return Number(o[key]);
  for (const v of Object.values(o)) { const r = findKey(v, key); if (r != null) return r; }
  return null;
}
function findInterval(o) {
  if (!o || typeof o !== "object") return null;
  if (o.startTime && o.endTime) return { start: o.startTime, end: o.endTime };
  for (const v of Object.values(o)) { if (v && typeof v === "object") { const r = findInterval(v); if (r) return r; } }
  return null;
}
async function sleepHoursFromList(o) {
  const pts = await listPoints(o, "sleep", 16);
  if (!pts.length) return null;
  const cutoff = Date.now() - 20 * 3600e3; // last ~20h = last night
  let ms = 0;
  for (const p of pts) { const iv = findInterval(p); if (iv) { const s = Date.parse(iv.start), e = Date.parse(iv.end); if (Number.isFinite(s) && Number.isFinite(e) && e > s && e >= cutoff) ms += e - s; } }
  return ms > 0 ? +(ms / 3600e3).toFixed(1) : null;
}

/** Live fetch of today's health snapshot from the Google Health API. */
export async function refreshHealth() {
  const o = await authed();
  if (!o) return { connected: false };
  const out = { connected: true, fetchedAt: new Date().toISOString() };
  try { out.steps = await rollup(o, "steps", 1, "first"); } catch { out.steps = null; }
  try { out.activeMinutes = await rollup(o, "active-zone-minutes", 1, "sum"); } catch { out.activeMinutes = null; }
  try { const p = await listPoints(o, "daily-resting-heart-rate", 1); const n = p.length ? deepNumbers(p[0]).filter((x) => x >= 25 && x <= 220) : []; out.restingHr = n.length ? Math.round(n[0]) : null; } catch { out.restingHr = null; }
  try { out.sleepHours = await sleepHoursFromList(o); } catch { out.sleepHours = null; }
  try { const p = await listPoints(o, "weight", 1); const g = p.length ? findKey(p[0], "weightGrams") : null; out.weight = g != null ? Math.round(g / 453.59237) : null; } catch { out.weight = null; }
  setMeta("health_cache", JSON.stringify(out));
  return out;
}

/** Raw diagnostic: shows the HTTP status + body for each data type call. */
export async function debugHealth() {
  const o = await authed();
  if (!o) return { connected: false };
  let token = "";
  try { token = (await o.getAccessToken()).token; } catch (e) { return { connected: true, tokenError: e.message }; }
  const out = { connected: true };
  const rollupReq = (id) => fetch(`https://health.googleapis.com/v4/users/me/dataTypes/${id}/dataPoints:dailyRollUp`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ range: civilRange(3), windowSizeDays: 1, pageSize: 14, dataSourceFamily: "users/me/dataSourceFamilies/all-sources" }), signal: AbortSignal.timeout(12000) });
  const listReq = (id) => fetch(`https://health.googleapis.com/v4/users/me/dataTypes/${id}/dataPoints?pageSize=3`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
  const calls = { steps: () => rollupReq("steps"), "active-zone-minutes": () => rollupReq("active-zone-minutes"), "daily-resting-heart-rate": () => listReq("daily-resting-heart-rate"), sleep: () => listReq("sleep"), weight: () => listReq("weight") };
  for (const [k, fn] of Object.entries(calls)) {
    try { const r = await fn(); out[k] = { status: r.status, body: (await r.text()).slice(0, 800) }; } catch (e) { out[k] = { error: e.message }; }
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
