// Autonomous briefing: cluster open tasks + unhandled mail by theme, produce a
// prioritized action list. Sonnet (SMART). Runs hourly; 7:30 AM run is primary.
import { getDb } from "./db.js";
import { askJSON, SMART } from "./claude.js";
import { getOpenTasks } from "./queries.js";

const SYSTEM =
  "You are Kurt's chief of staff. You read his open tasks and unhandled email and produce a crisp briefing: cluster everything by real-world theme/project, then give a short prioritized action list. Be concrete and specific to the actual items — never generic filler.";

export async function generateBriefing({ primary = false } = {}) {
  const db = getDb();
  const tasks = getOpenTasks().filter((t) => t.type !== "grocery_item");
  const emails = db
    .prepare(
      `SELECT id,account,sender,subject,why,triage_tier FROM emails
       WHERE handled=0 AND triage_tier IN ('act','review','quick')
       ORDER BY datetime(received_at) DESC LIMIT 45`
    )
    .all();

  const payload = {
    tasks: tasks.map((t) => ({ id: t.id, text: t.text, tags: t.tags })),
    emails: emails.map((e) => ({ id: e.id, from: e.sender, subject: e.subject, tier: e.triage_tier, why: e.why })),
  };

  const prompt = `Kurt's open tasks and unhandled emails as JSON:

${JSON.stringify(payload)}

Return ONE JSON object, exactly this shape:
{
 "greeting": "<=14 words, warm, specific to today's actual shape",
 "priorities": [ {"title":"<=10 words","detail":"<=22 words, concrete next step","urgency":"now"|"today"|"soon"} ],
 "clusters": [ {"name":"real theme, e.g. 'i9 Sports' or 'Condo security'","summary":"<=22 words","taskIds":["..."],"emailIds":["..."],"suggestProject":true} ]
}
Rules: 3-6 priorities, most important first. At most 6 clusters, each with 2+ related items; cap taskIds and emailIds at 8 each. Set suggestProject true when the cluster is an ongoing initiative worth tracking as a project. Use the real ids from the input. Return ONLY the JSON object, no markdown.`;

  const data = await askJSON({ model: SMART, system: SYSTEM, prompt, max_tokens: 4000 });
  data.greeting = data.greeting || "Here's where things stand.";
  data.priorities = Array.isArray(data.priorities) ? data.priorities : [];
  const clusters = Array.isArray(data.clusters) ? data.clusters : [];

  const tx = db.transaction(() => {
    // drop only clusters no created project depends on (keeps suggested-project links stable)
    db.prepare("DELETE FROM clusters WHERE id NOT IN (SELECT cluster_id FROM projects WHERE cluster_id IS NOT NULL)").run();
    const ins = db.prepare("INSERT INTO clusters (name,summary) VALUES (?,?)");
    for (const c of clusters) {
      const r = ins.run(c.name || "Theme", c.summary || "");
      c.id = Number(r.lastInsertRowid);
    }
    if (primary) db.prepare("UPDATE briefings SET is_primary=0 WHERE date(generated_at)=date('now')").run();
    db.prepare("INSERT INTO briefings (content,is_primary) VALUES (?,?)").run(JSON.stringify(data), primary ? 1 : 0);
  });
  tx();
  return data;
}
