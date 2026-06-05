// Standing rules: persistent instructions the watcher runs on new mail every 15 min.
// Unlike chat, a rule is PRE-AUTHORIZED by Kurt, so its events are created
// autonomously — with dedupe against already-created events to avoid repeats.
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./db.js";
import { SMART } from "./claude.js";
import { searchMail, getBody, createEvent } from "./google.js";

let _c;
const client = () => (_c = _c || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const TOOLS = [
  { name: "search_email", description: "Search Kurt's Gmail (both accounts unless specified). Gmail search syntax.",
    input_schema: { type: "object", properties: { query: { type: "string" }, account: { type: "string", enum: ["personal", "work", "both"] } }, required: ["query"] } },
  { name: "read_email", description: "Read one email's full body to extract exact times/dates/addresses.",
    input_schema: { type: "object", properties: { id: { type: "string" }, account: { type: "string", enum: ["personal", "work"] } }, required: ["id", "account"] } },
  { name: "add_event", description: "Add a confirmed event to Kurt's personal calendar. Only call with a clear date AND time. Duplicates are skipped automatically.",
    input_schema: { type: "object", properties: {
      summary: { type: "string" }, location: { type: "string" },
      start: { type: "string", description: "ISO 8601 with America/New_York offset" },
      end: { type: "string", description: "ISO 8601 with offset" },
    }, required: ["summary", "start", "end"] } },
];

function alreadyExists(db, summary, start) {
  return !!db.prepare("SELECT 1 FROM calendar_events WHERE title=? AND start=?").get(summary, start);
}

async function runTool(name, input, ctx) {
  const db = getDb();
  if (name === "search_email") {
    const accts = input.account && input.account !== "both" ? [input.account] : ["personal", "work"];
    let rows = [];
    for (const a of accts) { try { rows = rows.concat(await searchMail(a, input.query, 10)); } catch (e) { rows.push({ error: `${a}: ${e.message}` }); } }
    return rows.slice(0, 16);
  }
  if (name === "read_email") {
    try { return { id: input.id, body: await getBody(input.account, input.id) }; } catch (e) { return { error: e.message }; }
  }
  if (name === "add_event") {
    if (alreadyExists(db, input.summary, input.start)) return { skipped: "duplicate" };
    try {
      const ev = await createEvent("personal", { summary: input.summary, location: input.location || "", start: input.start, end: input.end });
      db.prepare(`INSERT INTO calendar_events (rule_id,gcal_event_id,calendar_account,title,location,start,end,source) VALUES (?,?, 'personal', ?,?,?,?, 'rule')`)
        .run(ctx.ruleId, ev.id, input.summary, input.location || "", input.start, input.end);
      ctx.created.push({ summary: input.summary, start: input.start });
      return { ok: true, id: ev.id };
    } catch (e) { return { error: e.message }; }
  }
  return { error: "unknown tool" };
}

export async function runRule(rule) {
  const today = new Date().toISOString().slice(0, 10);
  const system =
    `You run a standing rule for Kurt autonomously. Rule: "${rule.instruction}". Today is ${today} (America/New_York). ` +
    `Search his recent email for anything matching the rule, read the relevant messages, and add any NEW concrete events (clear date AND time) to his calendar via add_event. ` +
    `Duplicates are skipped automatically, so it's safe to re-run. If nothing new/concrete is found, add nothing. End with a one-line summary of what you added.`;

  const ctx = { ruleId: rule.id, created: [] };
  const messages = [{ role: "user", content: "Run this rule now against my latest email." }];
  let finalText = "";

  for (let step = 0; step < 6; step++) {
    const resp = await client().messages.create({ model: SMART, max_tokens: 1500, system, tools: TOOLS, messages });
    const toolUses = (resp.content || []).filter((b) => b.type === "tool_use");
    finalText = (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (resp.stop_reason !== "tool_use" || !toolUses.length) break;
    messages.push({ role: "assistant", content: resp.content });
    const results = [];
    for (const tu of toolUses) results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(await runTool(tu.name, tu.input, ctx)) });
    messages.push({ role: "user", content: results });
  }

  getDb().prepare("UPDATE standing_rules SET last_run=datetime('now') WHERE id=?").run(rule.id);
  return { ruleId: rule.id, created: ctx.created, summary: finalText || `Added ${ctx.created.length} event(s).` };
}

export async function runAllRules() {
  const rules = getDb().prepare("SELECT * FROM standing_rules WHERE enabled=1").all();
  const out = [];
  for (const r of rules) {
    try { out.push(await runRule(r)); }
    catch (e) { out.push({ ruleId: r.id, error: e.message }); }
  }
  return out;
}
