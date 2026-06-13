// Autonomous briefing: cluster open tasks + unhandled mail by theme, produce a
// prioritized action list. Sonnet (SMART). Runs hourly; 7:30 AM run is primary.
import { getDb } from "./db.js";
import { askJSON, SMART } from "./claude.js";
import { getOpenTasks, getLatestBriefing } from "./queries.js";
import { getMeta } from "./meta.js";
import { listFlaggedNotifications } from "./notify.js";
import { kidsBoard } from "./coparent.js";

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

  // Fold in the family/alerts/health surfaces so the one email that comes TO Kurt
  // covers everything, not just tasks + mail.
  const kb = kidsBoard();
  const kidItems = []; const seenKid = new Set();
  for (const k of (kb.kids || [])) for (const it of k.items) if (!seenKid.has(it.id)) { seenKid.add(it.id); kidItems.push({ kid: k.name, subject: it.subject, why: it.why }); }
  const alerts = listFlaggedNotifications(6).map((n) => ({ title: (n.title || "") + (n.body ? ": " + n.body : ""), why: n.why }));
  let health = null;
  try { const hc = JSON.parse(getMeta("health_cache") || "{}"); if (hc.connected) health = { steps: hc.steps, sleepHours: hc.sleepHours, restingHr: hc.restingHr }; } catch {}

  const payload = {
    tasks: tasks.map((t) => ({ id: t.id, text: t.text, tags: t.tags, ...(t.due ? { due: t.due } : {}) })),
    emails: emails.map((e) => ({ id: e.id, from: e.sender, subject: e.subject, tier: e.triage_tier, why: e.why })),
    kids: kidItems.slice(0, 6),
    alerts: alerts.slice(0, 6),
  };

  const prompt = `Kurt's open tasks, unhandled emails, kid co-parenting items, and flagged phone alerts as JSON:

${JSON.stringify(payload)}

"kids" are time-sensitive items about his children (school/medical/schedule) and "alerts" are flagged phone messages — treat these as high-signal and weave the most important into the greeting and priorities.

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
  data.family = { kids: kidItems.slice(0, 8), alerts: alerts.slice(0, 8), health };

  // Snapshot of current state + delta vs the previous briefing (robust to the sync wipe/re-insert).
  const prev = getLatestBriefing();
  const curAct = db.prepare("SELECT id,account,sender,subject FROM emails WHERE handled=0 AND triage_tier='act'").all();
  const openIds = tasks.map((t) => t.id);
  data._snapshot = { actIds: curAct.map((e) => e.id), openTaskIds: openIds };
  if (prev && prev._snapshot) {
    const prevAct = new Set(prev._snapshot.actIds || []);
    const newAct = curAct.filter((e) => !prevAct.has(e.id));
    const curOpen = new Set(openIds);
    const cleared = (prev._snapshot.openTaskIds || []).filter((id) => !curOpen.has(id)).length;
    const ruleEvents = db.prepare("SELECT COUNT(*) c FROM calendar_events WHERE source='rule' AND datetime(created_at) > datetime(?)").get(prev.generated_at).c;
    if (newAct.length || cleared || ruleEvents)
      data.delta = { newActCount: newAct.length, newAct: newAct.slice(0, 6).map((e) => ({ id: e.id, account: e.account, sender: e.sender, subject: e.subject })), cleared, ruleEvents };
  }

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

const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** Render a briefing object as a warm HTML email body. */
export function briefingToHtml(data, dateLabel) {
  const pill = { now: "#b0432a", today: "#C2851E", soon: "#6b7a64" };
  const prios = (data.priorities || []).map((p, i) =>
    `<tr><td style="padding:8px 0;vertical-align:top;width:28px">
       <div style="width:22px;height:22px;border-radius:50%;background:#E0A23C;color:#fff;font-weight:700;font-size:12px;text-align:center;line-height:22px">${i + 1}</div></td>
     <td style="padding:8px 0;vertical-align:top">
       <div style="font-weight:700;font-size:15px;color:#2B2925">${esc(p.title)}
         <span style="font-size:10px;font-weight:800;text-transform:uppercase;color:${pill[p.urgency] || pill.soon}">&nbsp;${esc(p.urgency || "soon")}</span></div>
       <div style="font-size:13px;color:#5d574b;margin-top:2px">${esc(p.detail)}</div></td></tr>`).join("");
  const clusters = (data.clusters || []).map((c) =>
    `<li style="margin:4px 0;font-size:13px;color:#5d574b"><b style="color:#2B2925">${esc(c.name)}</b> — ${esc(c.summary)}</li>`).join("");
  const fam = data.family || {};
  const famRows = [
    ...(fam.kids || []).map((k) => `<li style="margin:4px 0;font-size:13px;color:#5d574b">👪 <b style="color:#2B2925">${esc(k.kid)}</b> — ${esc(k.subject)}${k.why ? ` <span style="color:#9b9384">(${esc(k.why)})</span>` : ""}</li>`),
    ...(fam.alerts || []).map((a) => `<li style="margin:4px 0;font-size:13px;color:#5d574b">🚩 ${esc(a.title)}${a.why ? ` <span style="color:#9b9384">(${esc(a.why)})</span>` : ""}</li>`),
  ].join("");
  const famBlock = famRows
    ? `<div style="margin-top:18px;border-top:1px dashed #ECE5D6;padding-top:12px">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9b9384;font-weight:700;margin-bottom:6px">Family &amp; alerts</div>
        <ul style="margin:0;padding-left:18px;list-style:none">${famRows}</ul></div>`
    : "";
  const healthLine = fam.health
    ? `<div style="margin-top:14px;font-size:12px;color:#9b9384">❤ ${fam.health.steps != null ? Number(fam.health.steps).toLocaleString() + " steps" : ""}${fam.health.sleepHours != null ? " · " + fam.health.sleepHours + "h sleep" : ""}${fam.health.restingHr != null ? " · " + fam.health.restingHr + " bpm resting" : ""}</div>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fbf6ea;padding:24px;border-radius:16px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9b9384;font-weight:700">✦ Morning Briefing · ${esc(dateLabel || "")}</div>
    <div style="font-family:Georgia,serif;font-size:22px;color:#2B2925;margin:6px 0 16px">${esc(data.greeting)}</div>
    <table style="width:100%;border-collapse:collapse">${prios}</table>
    ${famBlock}
    ${clusters ? `<div style="margin-top:18px;border-top:1px dashed #ECE5D6;padding-top:12px">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9b9384;font-weight:700;margin-bottom:6px">Themes</div>
      <ul style="margin:0;padding-left:18px">${clusters}</ul></div>` : ""}
    ${healthLine}
    <div style="margin-top:18px;font-size:11px;color:#9b9384">Sent by your Command Center.</div>
  </div>`;
}
