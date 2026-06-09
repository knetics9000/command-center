import { getDb } from "./db.js";
import { analyzeContent, kindFromUrl } from "./share.js";

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
    source: row.source, analyzed: row.analyzed === 1, createdAt: row.created_at,
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

export function insertMaterial({ url, text, title, influenceId, source = "app" }) {
  const db = getDb();
  const info = db.prepare(
    "INSERT INTO guru_materials (url, kind, title, text, influence_id, source, analyzed, created_at) VALUES (?,?,?,?,?,?,0,?)",
  ).run(url || null, kindFromUrl(url), title || null, text || null, influenceId || null, source, Date.now());
  return info.lastInsertRowid;
}

/** Background: analyze a material row and write the knowledge columns. Best-effort. */
export async function analyzeGuruMaterial(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM guru_materials WHERE id=?").get(id);
  if (!row) return;
  const a = await analyzeContent({ url: row.url, title: row.title, text: row.text });
  db.prepare(`UPDATE guru_materials SET ai_title=?, categories=?, summary=?, takeaways=?, insights=?, tools=?, people=?, credibility=?, cred_reason=?, analyzed=1 WHERE id=?`).run(
    a.aiTitle, arr(a.categories), a.summary, arr(a.takeaways), arr(a.insights), arr(a.tools), arr(a.people), a.credibility, a.credReason, id,
  );
}

export function listMaterials({ q, influenceId } = {}) {
  const db = getDb();
  let sql = "SELECT m.*, i.name AS influence_name FROM guru_materials m LEFT JOIN guru_influences i ON i.id = m.influence_id";
  const where = [], args = [];
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
