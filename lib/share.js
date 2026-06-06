import { getDb } from "./db.js";
import { askJSON, FAST } from "./claude.js";
import { BUCKETS } from "./buckets.js";

const URL_RE = /(https?:\/\/[^\s]+)/i;

/** Categorize a shared item with Claude and log it. */
export async function logShare({ title, text, url }) {
  const db = getDb();
  const link = (url || "").trim() || (((text || "").match(URL_RE) || [])[0] || "");
  const rawTitle = (title || "").trim() || (text || "").replace(URL_RE, "").trim().slice(0, 140);
  let category = "", kind = "link", cleanTitle = rawTitle || link || "Shared item";

  try {
    const out = await askJSON({
      model: FAST,
      system: "You file things Kurt shares into his Command Center. Be concise.",
      prompt: `Kurt shared this from another app.\nTitle: "${rawTitle}"\nURL: "${link}"\nText: "${(text || "").slice(0, 400)}"\n\nReturn {"title":"<short clean title>","kind":"video|article|product|recipe|link|note","category":"<best fit: ${BUCKETS.join(", ")}, or 'Read / Watch Later', or ''>"} only.`,
      max_tokens: 200,
    });
    if (out.title) cleanTitle = String(out.title).slice(0, 160);
    if (out.kind) kind = String(out.kind).slice(0, 20);
    if (out.category) category = String(out.category).slice(0, 40);
  } catch {}

  const info = db.prepare("INSERT INTO shared_items (title,url,text,category,kind) VALUES (?,?,?,?,?)")
    .run(cleanTitle, link, (text || "").slice(0, 1000), category, kind);
  return { id: info.lastInsertRowid, title: cleanTitle, url: link, category, kind };
}

export function listShared(limit = 100) {
  return getDb().prepare("SELECT id,title,url,category,kind,created_at FROM shared_items ORDER BY id DESC LIMIT ?").all(limit);
}
export function deleteShared(id) {
  getDb().prepare("DELETE FROM shared_items WHERE id=?").run(id);
}
