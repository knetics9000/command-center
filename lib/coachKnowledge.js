import { getDb } from "./db.js";
import { analyzeContent, kindFromUrl } from "./share.js";
import { askFast, askJSON, SMART } from "./claude.js";

const arr = (x) => JSON.stringify(Array.isArray(x) ? x.slice(0, 12).map(String) : []);
const parseArr = (s) => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };

/** Shape a guru_materials row (+ optional influence_name) into an API DTO. */
export function parseMaterialRow(row) {
  if (!row) return null;
  return {
    id: row.id, url: row.url, kind: row.kind, title: row.title, text: row.text,
    aiTitle: row.ai_title, summary: row.summary,
    categories: parseArr(row.categories), takeaways: parseArr(row.takeaways),
    insights: parseArr(row.insights), tools: parseArr(row.tools), people: parseArr(row.people),
    credibility: row.credibility, credReason: row.cred_reason,
    influenceId: row.influence_id, influenceName: row.influence_name || null,
    source: row.source, type: row.type || "material",
    analyzed: row.analyzed === 1, createdAt: row.created_at,
  };
}

export function findOrCreateInfluence(db, { id, name }) {
  if (id) return id;
  if (!name) return null;
  const existing = db.prepare("SELECT id FROM guru_influences WHERE name = ? COLLATE NOCASE").get(name);
  if (existing) return existing.id;
  const info = db.prepare("INSERT INTO guru_influences (name, created_at) VALUES (?, ?)").run(name, Date.now());
  return info.lastInsertRowid;
}

export function insertMaterial({ url, text, title, influenceId, source = "app", type = "material" }) {
  const db = getDb();
  const info = db.prepare(
    "INSERT INTO guru_materials (url, kind, title, text, influence_id, source, type, analyzed, created_at) VALUES (?,?,?,?,?,?,?,0,?)",
  ).run(url || null, kindFromUrl(url), title || null, text || null, influenceId || null, source, type, Date.now());
  return info.lastInsertRowid;
}

/** Pure: split text into <=size chunks (joins back to the original). */
export function chunkText(text, size = 8000) {
  const out = [];
  for (let i = 0; i < (text || "").length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/** Map-reduce a long text down to <=maxChars via Haiku chunk summaries. Best-effort. */
export async function summarizeLong(text, { chunkSize = 8000, maxChars = 12000 } = {}) {
  let t = text || "";
  while (t.length > maxChars) {
    const sums = [];
    for (const part of chunkText(t, chunkSize)) {
      sums.push(await askFast(
        `Summarize this excerpt of a longer personal document in <=150 words. Keep concrete facts, names, decisions, and dates:\n\n${part}`,
      ));
    }
    const combined = sums.join("\n\n");
    if (combined.length >= t.length) return combined.slice(0, maxChars); // safety: never loop on non-shrinking text
    t = combined;
  }
  return t;
}

/** Analyze a personal-history item: what this says about Kurt. No credibility scoring. */
export async function analyzePersonal({ title, text }) {
  const body = (text || "").length > 12000 ? await summarizeLong(text) : (text || "");
  let out = {};
  try {
    out = await askJSON({
      model: SMART,
      system: "You are Kurt's personal coach, turning his own history (past conversations, notes, life events) into reference notes a coach can draw on later. Be concrete and factual; never invent.",
      prompt:
        `TITLE: ${title || ""}\nCONTENT:\n${body}\n\n` +
        `Return ONE JSON object:\n{"aiTitle":"<short title for this piece of history, <=12 words>",` +
        `"summary":"<2-4 sentences: what happened / what this is about>",` +
        `"takeaways":["<2-6 key facts or themes about Kurt from this>"],` +
        `"insights":["<1-4 patterns/preferences a coach should remember>"],` +
        `"people":["<people mentioned>"]}\nReturn ONLY the JSON.`,
      max_tokens: 1200,
    });
  } catch {}
  return {
    aiTitle: (out.aiTitle || title || "Personal note").slice(0, 160),
    summary: (out.summary || "").slice(0, 800),
    takeaways: out.takeaways, insights: out.insights, people: out.people,
  };
}

/** Background: analyze a material row and write the knowledge columns. Best-effort. */
export async function analyzeGuruMaterial(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM guru_materials WHERE id=?").get(id);
  if (!row) return;
  if ((row.type || "material") === "personal") {
    const a = await analyzePersonal({ title: row.title, text: row.text });
    db.prepare(`UPDATE guru_materials SET ai_title=?, categories='[]', summary=?, takeaways=?, insights=?, tools='[]', people=?, analyzed=1 WHERE id=?`).run(
      a.aiTitle, a.summary, arr(a.takeaways), arr(a.insights), arr(a.people), id,
    );
    return;
  }
  const a = await analyzeContent({ url: row.url, title: row.title, text: row.text });
  db.prepare(`UPDATE guru_materials SET ai_title=?, categories=?, summary=?, takeaways=?, insights=?, tools=?, people=?, credibility=?, cred_reason=?, analyzed=1 WHERE id=?`).run(
    a.aiTitle, arr(a.categories), a.summary, arr(a.takeaways), arr(a.insights), arr(a.tools), arr(a.people), a.credibility, a.credReason, id,
  );
}

export function listMaterials({ q, influenceId, type } = {}) {
  const db = getDb();
  let sql = "SELECT m.*, i.name AS influence_name FROM guru_materials m LEFT JOIN guru_influences i ON i.id = m.influence_id";
  const where = [], args = [];
  if (type) { where.push("COALESCE(m.type,'material') = ?"); args.push(type); }
  if (influenceId) { where.push("m.influence_id = ?"); args.push(influenceId); }
  if (q) { where.push("(m.ai_title LIKE ? OR m.summary LIKE ? OR m.title LIKE ? OR m.text LIKE ?)"); const like = `%${q}%`; args.push(like, like, like, like); }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY m.created_at DESC";
  return db.prepare(sql).all(...args).map(parseMaterialRow);
}

export function listInfluences() {
  const db = getDb();
  return db.prepare(
    "SELECT i.*, (SELECT COUNT(*) FROM guru_materials m WHERE m.influence_id = i.id) AS material_count FROM guru_influences i ORDER BY i.name COLLATE NOCASE",
  ).all().map((r) => ({ id: r.id, name: r.name, why: r.why, styleNotes: r.style_notes, materialCount: r.material_count, createdAt: r.created_at }));
}

export function upsertInfluence({ id, name, why, styleNotes }) {
  const db = getDb();
  if (id) {
    db.prepare("UPDATE guru_influences SET name=?, why=?, style_notes=? WHERE id=?").run(name, why || null, styleNotes || null, id);
    return id;
  }
  return db.prepare("INSERT INTO guru_influences (name, why, style_notes, created_at) VALUES (?,?,?,?)").run(name, why || null, styleNotes || null, Date.now()).lastInsertRowid;
}

export function deleteMaterial(id) { getDb().prepare("DELETE FROM guru_materials WHERE id=?").run(id); }
export function deleteInfluence(id) {
  const db = getDb();
  db.prepare("UPDATE guru_materials SET influence_id=NULL WHERE influence_id=?").run(id);
  db.prepare("DELETE FROM guru_influences WHERE id=?").run(id);
}
