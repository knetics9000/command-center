import { getDb } from "./db.js";
import { listMaterials } from "./coachKnowledge.js";
import { askJSON, FAST, SMART } from "./claude.js";

const INDEX_CAP = 200; // newest items considered; bounds the Haiku prompt

/** Pure: keep caller-proposed ids that exist, deduped, in order, capped at k. */
export function pickValidIds(ids, validIds, k) {
  const out = [];
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = Number(raw);
    if (validIds.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= k) break;
  }
  return out;
}

/** Pure: human label for a source row. */
export function sourceLabel(row) {
  const title = row.aiTitle || row.title || row.url || "Untitled";
  if (row.type === "personal") return `My history: ${title}`;
  return row.influenceName ? `${title} — ${row.influenceName}` : title;
}

/** Compact one-line-per-item index of the analyzed knowledge base (newest INDEX_CAP). */
export function buildIndex() {
  return listMaterials({})
    .filter((m) => m.analyzed)
    .slice(0, INDEX_CAP); // listMaterials is newest-first
}

/** Haiku picks up to k relevant items for the situation. Empty/failed → []. */
export async function retrieveRelevant(situation, k = 6) {
  const index = buildIndex();
  if (!index.length) return [];
  const lines = index.map((m) =>
    `${m.id} | ${m.type} | ${sourceLabel(m)} — ${(m.summary || "").slice(0, 160)}`).join("\n");
  let out = {};
  try {
    out = await askJSON({
      model: FAST,
      system: "You select which items from Kurt's personal knowledge base are most useful for coaching him on a situation. Be selective — only genuinely relevant items.",
      prompt: `SITUATION: ${situation}\n\nKNOWLEDGE BASE (id | kind | title — summary):\n${lines}\n\nReturn ONE JSON object: {"ids":[<up to ${k} item ids, most relevant first; [] if nothing truly fits>]}\nReturn ONLY the JSON.`,
      max_tokens: 300,
    });
  } catch {}
  const picked = pickValidIds(out.ids, new Set(index.map((m) => m.id)), k);
  return index.filter((m) => picked.includes(m.id));
}

/** Sonnet writes the knowledge-grounded deep version. Throws on failure (route 500s → device falls back). */
export async function generateDeep({ situation, shortAnswer, personaName, personaVoice, profile, items }) {
  const sources = items.map((m) =>
    `[${m.id}] ${sourceLabel(m)}\n  Summary: ${m.summary || ""}\n  Takeaways: ${(m.takeaways || []).join("; ")}\n  Insights: ${(m.insights || []).join("; ")}`).join("\n");
  const out = await askJSON({
    model: SMART,
    system:
      `You are ${personaName || "the Guru"}, Kurt's personal coach. Voice: ${personaVoice || "warm and direct"}. ` +
      `Never sound like a generic chatbot.` + (profile ? `\nWhat you know about Kurt:\n${profile}` : ""),
    prompt:
      `Kurt's situation: ${situation}\n\n` +
      `The short answer he already saw:\n${shortAnswer.situationRead || ""}\n${(shortAnswer.steps || []).map((s) => `- ${s}`).join("\n")}\n\n` +
      (sources ? `HIS KNOWLEDGE BASE — sources you may draw on:\n${sources}\n\n` : "") +
      `Write the DEEPER version: the why behind the advice, the one key move, what to watch for. ` +
      `A few tight paragraphs (under 2500 characters), same voice. ` +
      (sources
        ? `Ground it in whichever sources genuinely apply — reference them naturally ("Newport's point about...", "like that conversation where you..."). Do NOT force irrelevant sources. `
        : "") +
      `Return ONE JSON object: {"deep":"<the deeper version>","sourceIds":[<ids of sources that actually informed it; [] if none>]}\nReturn ONLY the JSON.`,
    max_tokens: 2000,
  });
  if (!out.deep) throw new Error("no deep generated");
  return {
    deep: String(out.deep).slice(0, 2500),
    sourceIds: pickValidIds(out.sourceIds, new Set(items.map((m) => m.id)), items.length),
  };
}

/** Best-effort learning-corpus row. */
export function logInteraction({ conversationId, situation, shortAnswer, retrievedIds, sourceIds, deep }) {
  getDb().prepare(
    "INSERT INTO coach_interactions (conversation_id, situation, short_answer, retrieved_ids, source_ids, deep, created_at) VALUES (?,?,?,?,?,?,?)",
  ).run(conversationId || null, situation, JSON.stringify(shortAnswer || {}), JSON.stringify(retrievedIds), JSON.stringify(sourceIds), deep, Date.now());
}
