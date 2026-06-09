import { getDb } from "./db.js";
import { askJSON, SMART } from "./claude.js";
import { getProjects } from "./queries.js";

const URL_RE = /(https?:\/\/[^\s]+)/i;

export function kindFromUrl(url) {
  const u = (url || "").toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com|tiktok\.com/.test(u)) return "video";
  if (/instagram\.com|twitter\.com|x\.com|facebook\.com|threads\.net|reddit\.com/.test(u)) return "social";
  if (/\.pdf($|\?)/.test(u)) return "pdf";
  if (/spotify\.com|podcasts\.apple|pod\.link/.test(u)) return "podcast";
  if (u) return "article";
  return "note";
}

const decode = (s) => (s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

/** Best-effort fetch of a URL's title/description/main text (server-side). */
async function fetchContent(url) {
  let domain = "";
  try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { return { domain }; }
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CommandCenterBot/1.0)" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    const html = await res.text();
    const meta = (p) => { const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + p + '["\'][^>]+content=["\']([^"\']*)', "i")); return m ? decode(m[1]) : ""; };
    const titleTag = decode((html.match(/<title[^>]*>([^<]*)</i) || [])[1] || "");
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
    return { domain, fetchedTitle: meta("og:title") || titleTag, description: meta("og:description") || meta("description"), site: meta("og:site_name"), text };
  } catch { return { domain }; }
}

/** Fetch a URL's content (if any) and AI-analyze it into structured knowledge.
 *  projectTags is optional — when provided, the prompt asks for Kurt's project tags too. */
export async function analyzeContent({ url, title, text, projectTags }) {
  const content = url ? await fetchContent(url) : { domain: "" };
  const wantsProjects = Array.isArray(projectTags) && projectTags.length > 0;
  let out = {};
  try {
    out = await askJSON({
      model: SMART,
      system: "You are Kurt's research assistant. Turn shared content into structured, actionable knowledge. Infer from title/URL if the page text is thin.",
      prompt:
        `Analyze this shared item.\nORIGINAL TITLE: ${title || ""}\nURL: ${url || ""}\nDOMAIN: ${content.domain || ""}\nFETCHED TITLE: ${content.fetchedTitle || ""}\nDESCRIPTION: ${content.description || ""}\nPAGE TEXT (excerpt): ${(content.text || "").slice(0, 4000)}\nKURT'S NOTE: ${text || ""}\n\n` +
        (wantsProjects ? `Kurt's existing project tags (for "projects", choose ONLY from these, 0-3): ${JSON.stringify(projectTags)}\n\n` : "") +
        `Return ONE JSON object:\n{"aiTitle":"<clear title describing the REAL value, <=12 words>","categories":["<1-3 content categories like Tutorial, Product Review, AI Development, Business Strategy, Industry News, Podcast>"],"summary":"<2-3 sentence executive summary>","takeaways":["<3-6 key points>"],"insights":["<2-4 actionable insights Kurt can apply>"],"tools":["<tools/products/sites/frameworks mentioned>"],"people":["<people/creators/companies>"]` +
        (wantsProjects ? `,"projects":["<0-3 of Kurt's project tags>"]` : "") +
        `,"credibility":<integer 0-100 estimating source trustworthiness>,"credReason":"<one short sentence>"}\nReturn ONLY the JSON.`,
      max_tokens: 1600,
    });
  } catch {}
  return {
    aiTitle: (out.aiTitle || content.fetchedTitle || title || "Untitled").slice(0, 160),
    categories: out.categories, summary: (out.summary || "").slice(0, 800),
    takeaways: out.takeaways, insights: out.insights, tools: out.tools, people: out.people,
    projects: out.projects,
    credibility: Number.isFinite(+out.credibility) ? Math.max(0, Math.min(100, Math.round(+out.credibility))) : null,
    credReason: (out.credReason || "").slice(0, 200),
  };
}

/** Fetch + AI-analyze a shared item, writing the knowledge layer onto its row. */
export async function analyzeShare(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM shared_items WHERE id=?").get(id);
  if (!row) return;
  let projTags = [];
  try { projTags = getProjects().map((p) => p.tag); } catch {}
  const a = await analyzeContent({ url: row.url, title: row.title, text: row.text, projectTags: projTags });
  const arr = (x) => JSON.stringify(Array.isArray(x) ? x.slice(0, 12).map(String) : []);
  db.prepare(`UPDATE shared_items SET ai_title=?, categories=?, summary=?, takeaways=?, insights=?, tools=?, people=?, projects=?, credibility=?, cred_reason=?, analyzed=1 WHERE id=?`).run(
    a.aiTitle, arr(a.categories), a.summary, arr(a.takeaways), arr(a.insights), arr(a.tools), arr(a.people), arr(a.projects),
    a.credibility, a.credReason, id,
  );
}

/** Log a shared item, then analyze it (awaited so the share screen shows insights). */
export async function logShare({ title, text, url }) {
  const db = getDb();
  const link = (url || "").trim() || (((text || "").match(URL_RE) || [])[0] || "");
  const rawTitle = (title || "").trim() || (text || "").replace(URL_RE, "").trim().slice(0, 160) || link;
  const info = db.prepare("INSERT INTO shared_items (title,url,text,kind) VALUES (?,?,?,?)").run(rawTitle, link, (text || "").slice(0, 1000), kindFromUrl(link));
  const id = info.lastInsertRowid;
  try { await analyzeShare(id); } catch {}
  return getOne(id);
}

const parse = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
const hydrate = (r) => ({ ...r, categories: parse(r.categories), takeaways: parse(r.takeaways), insights: parse(r.insights), tools: parse(r.tools), people: parse(r.people), projects: parse(r.projects) });

export function getOne(id) {
  const r = getDb().prepare("SELECT * FROM shared_items WHERE id=?").get(id);
  return r ? hydrate(r) : null;
}
export function listShared(limit = 200) {
  return getDb().prepare("SELECT * FROM shared_items ORDER BY id DESC LIMIT ?").all(limit).map(hydrate);
}
export function deleteShared(id) { getDb().prepare("DELETE FROM shared_items WHERE id=?").run(id); }

/** Category -> count, for the dashboard widget. */
export function categoryCounts() {
  const counts = {};
  for (const r of getDb().prepare("SELECT categories FROM shared_items").all())
    for (const c of parse(r.categories)) counts[c] = (counts[c] || 0) + 1;
  return Object.entries(counts).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
}
