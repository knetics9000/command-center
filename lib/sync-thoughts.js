// Pull Offload "thoughts" (long-form voice/typed captures, AI-cleaned + summarized)
// from the same Apps Script Web App Offload already uses (action: "pullThoughts").
// Mirrors lib/offload.js's call pattern — same URL + token, server-side fetch.
// Upserts by id (re-synced thoughts update, never duplicate) and writes a
// heartbeat like every other source.
import { getDb } from "./db.js";
import { setMeta } from "./meta.js";

const URL = () => process.env.OFFLOAD_URL;
const TOKEN = () => process.env.OFFLOAD_TOKEN;
export const thoughtsConfigured = () => !!URL() && !!TOKEN();

async function call(body) {
  const res = await fetch(URL(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: TOKEN(), ...body }),
  });
  let j;
  try { j = await res.json(); } catch { j = { ok: false, error: "bad json" }; }
  if (!j.ok) throw new Error("Thoughts " + (body.action || "") + " failed: " + (j.error || res.status));
  return j;
}

/** Pull the Thoughts tab, upsert by id, stamp the heartbeat. Safe no-op if unconfigured. */
export async function syncThoughts() {
  if (!thoughtsConfigured()) return { configured: false };
  const j = await call({ action: "pullThoughts" });
  const rows = (j.rows || []).filter((r) => (r.id || "").toString().trim());
  const db = getDb();
  const up = db.prepare(
    `INSERT INTO thoughts (id,created_at,raw_text,retextualized_text,summary,source,synced_at)
     VALUES (@id,@created_at,@raw_text,@retextualized_text,@summary,@source,datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       created_at=excluded.created_at, raw_text=excluded.raw_text,
       retextualized_text=excluded.retextualized_text, summary=excluded.summary,
       source=excluded.source, synced_at=datetime('now')`
  );
  const tx = db.transaction(() => {
    for (const r of rows) up.run({
      id: (r.id || "").toString().trim(),
      created_at: (r.created_at || "").toString().trim(),
      raw_text: (r.raw_text || "").toString(),
      retextualized_text: (r.retextualized_text || "").toString(),
      summary: (r.summary || "").toString(),
      source: ((r.source || "").toString().trim().toLowerCase()) === "voice" ? "voice" : "typed",
    });
  });
  tx();
  setMeta("hb_thoughts", new Date().toISOString());
  return { configured: true, pulled: rows.length };
}

/** Bullet summary → clean lines (drop leading •/-/* markers; render our own bullets). */
export const summaryLines = (s) => (s || "").split(/\r?\n/).map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean);

/** Thoughts newest-first (by capture time, falling back to sync time). */
export function listThoughts(limit = 50) {
  return getDb()
    .prepare("SELECT * FROM thoughts ORDER BY datetime(COALESCE(NULLIF(created_at,''), synced_at)) DESC LIMIT ?")
    .all(limit);
}
export function thoughtsCount() {
  return getDb().prepare("SELECT COUNT(*) n FROM thoughts").get().n;
}
