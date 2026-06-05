// Offload sync over HTTPS via the existing Apps Script endpoint (pull / upsert / delete).
// Server-side fetch — full responses readable (no CORS / no-cors limits like the browser artifact).

const URL = () => process.env.OFFLOAD_URL;
const TOKEN = () => process.env.OFFLOAD_TOKEN;

async function call(body) {
  const res = await fetch(URL(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: TOKEN(), ...body }),
  });
  let j;
  try { j = await res.json(); } catch { j = { ok: false, error: "bad json" }; }
  if (!j.ok) throw new Error("Offload " + (body.action || "") + " failed: " + (j.error || res.status));
  return j;
}

/** All current Offload rows: [{id,text,type,tags,status,created}] */
export async function pullOffload() {
  const j = await call({ action: "pull" });
  return (j.rows || []).map((r) => ({
    id: (r.id || "").trim(),
    text: (r.text || "").trim(),
    type: (r.type || "").trim(),
    tags: (r.tags || "").trim(),
    status: (r.status || "").trim().toLowerCase(),
    created: (r.created || "").trim(),
  }));
}

/** Upsert rows by id; blank id appends (phone stamps id on next sync). Send only keys you want written. */
export async function upsertOffload(rows) {
  if (!rows || !rows.length) return;
  await call({ action: "upsert", rows });
}

export async function deleteOffload(ids) {
  if (!ids || !ids.length) return;
  await call({ action: "delete", ids });
}

/** Add a brand-new task (blank id). */
export function addTask(text, tags = "", type = "task") {
  return upsertOffload([{ id: "", text, type, tags, status: "open" }]);
}

/** Mark an existing item completed. */
export function completeTask(id) {
  return upsertOffload([{ id, status: "completed" }]);
}

/** Replace an item's full tags string. */
export function retagTask(id, tags) {
  return upsertOffload([{ id, tags }]);
}
