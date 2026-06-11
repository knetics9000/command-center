import { getDb } from "./db.js";
import { getMeta, setMeta } from "./meta.js";
import { listMaterials, listInfluences } from "./coachKnowledge.js";
import { askJSON, SMART } from "./claude.js";

const KEY = "coach_life_digest";
const MAX_ITEMS = 50;
const MAX_CHARS = 1800;

/** Fingerprint of the analyzed personal-history set: regenerate only when it changes. */
export function digestFingerprint() {
  const r = getDb().prepare(
    "SELECT COUNT(*) AS count, COALESCE(MAX(created_at), 0) AS latestAt FROM guru_materials WHERE COALESCE(type,'material')='personal' AND analyzed=1",
  ).get();
  return { count: r.count, latestAt: r.latestAt };
}

/** Pure: does the cached digest need regenerating? */
export function isStale(cached, fingerprint) {
  return !cached || cached.count !== fingerprint.count || cached.latestAt !== fingerprint.latestAt;
}

/** Pure: the generation prompt from pre-analyzed personal items + the gurus list. */
export function buildDigestPrompt(items, influences) {
  const itemLines = items.map((m) =>
    `- ${m.aiTitle || m.title || "Untitled"}: ${m.summary || ""}` +
    (m.takeaways?.length ? ` | Key facts: ${m.takeaways.join("; ")}` : "") +
    (m.people?.length ? ` | People: ${m.people.join(", ")}` : "")).join("\n");
  const guruLines = (influences || []).map((g) => `- ${g.name}${g.why ? ` — ${g.why}` : ""}`).join("\n");
  return (
    `PERSONAL HISTORY (pre-summarized items, newest first):\n${itemLines}\n\n` +
    (guruLines ? `GURUS HE FOLLOWS:\n${guruLines}\n\n` : "") +
    `Distill this into a coach's working memory of Kurt: ~300 words of third-person reference notes — ` +
    `key life facts, important people, timeline highlights, recurring patterns, past decisions and how they went. ` +
    `Concrete and factual; never invent.\n` +
    `Return ONE JSON object: {"digest":"<the notes>"}\nReturn ONLY the JSON.`
  );
}

/** One Sonnet call over the newest personal items. Returns the digest string; null when no items. */
export async function generateLifeDigest() {
  const items = listMaterials({ type: "personal" }).filter((m) => m.analyzed).slice(0, MAX_ITEMS);
  if (!items.length) return null;
  const out = await askJSON({
    model: SMART,
    system: "You maintain a personal coach's working memory of Kurt's life from his own shared history. Concrete facts only.",
    prompt: buildDigestPrompt(items, listInfluences()),
    max_tokens: 800,
  });
  if (!out.digest) throw new Error("no digest generated");
  return String(out.digest).slice(0, MAX_CHARS);
}

/** Cached-or-regenerated digest. Never throws; failures serve the stale digest or null. */
export async function ensureLifeDigest() {
  const fp = digestFingerprint();
  let cached = null;
  try { cached = JSON.parse(getMeta(KEY) || "null"); } catch {}
  if (!isStale(cached, fp)) return cached?.digest ?? null;
  if (fp.count === 0) {
    setMeta(KEY, JSON.stringify({ digest: null, ...fp, generatedAt: Date.now() }));
    return null;
  }
  try {
    const digest = await generateLifeDigest();
    setMeta(KEY, JSON.stringify({ digest, ...fp, generatedAt: Date.now() }));
    return digest;
  } catch {
    return cached?.digest ?? null;
  }
}
