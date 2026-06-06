// Command Center assistant: a Claude tool-use loop that answers Kurt's questions
// by querying his real dashboard data (tasks, emails, priorities, categories,
// projects, calendar) — plus live Gmail/Calendar when the cache isn't enough.
import Anthropic from "@anthropic-ai/sdk";
import { SMART } from "./claude.js";
import { getDb } from "./db.js";
import { getStats, getProjects, getDueTasks, getBucketSummary, tagsOf } from "./queries.js";
import { getPriorityInbox } from "./priority.js";
import { searchMail, getBody, listEvents } from "./google.js";
import { BUCKETS } from "./buckets.js";

let _c;
const client = () => (_c = _c || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const TOOLS = [
  { name: "get_overview", description: "High-level counts: open tasks, inbox size, act-now, priority emails, projects, email category breakdown, upcoming items.", input_schema: { type: "object", properties: {} } },
  { name: "search_tasks", description: "Search Kurt's to-do tasks (from Offload). Filter by free text, tag, status, or due-only.", input_schema: { type: "object", properties: { query: { type: "string" }, tag: { type: "string" }, status: { type: "string", enum: ["open", "all"] }, dueOnly: { type: "boolean" } } } },
  { name: "search_emails", description: "Search the cached inbox. Filter by text, life-category, triage tier (act/review/quick/noise), or priority-only. Defaults to unhandled mail.", input_schema: { type: "object", properties: { query: { type: "string" }, category: { type: "string" }, tier: { type: "string" }, priorityOnly: { type: "boolean" }, includeHandled: { type: "boolean" } } } },
  { name: "list_projects", description: "List active projects with open-task counts and progress.", input_schema: { type: "object", properties: {} } },
  { name: "list_calendar", description: "Upcoming calendar events (both Google accounts) + due tasks for the next N days (default 14).", input_schema: { type: "object", properties: { days: { type: "number" } } } },
  { name: "read_email", description: "Read one email's full body to answer detailed questions.", input_schema: { type: "object", properties: { id: { type: "string" }, account: { type: "string", enum: ["personal", "work"] } }, required: ["id", "account"] } },
  { name: "search_gmail", description: "Search live Gmail (any folder, both accounts) when something isn't in the cached inbox.", input_schema: { type: "object", properties: { query: { type: "string" }, account: { type: "string", enum: ["personal", "work", "both"] } }, required: ["query"] } },
];

async function runTool(name, input) {
  const db = getDb();
  try {
    if (name === "get_overview") {
      const s = getStats();
      const cats = db.prepare("SELECT COALESCE(NULLIF(category,''),'(none)') c, COUNT(*) n FROM emails WHERE handled=0 GROUP BY c ORDER BY n DESC").all();
      return { openTasks: s.openTasks, doneTasks: s.doneTasks, inbox: s.inbox, actNow: s.act, priorityEmails: getPriorityInbox(100).length, projects: s.projects, emailCategories: cats, buckets: getBucketSummary() };
    }
    if (name === "search_tasks") {
      let sql = "SELECT id,text,tags,status,due FROM tasks WHERE type!='grocery_item'"; const p = [];
      if (input.status !== "all") sql += " AND status='open'";
      if (input.tag) { sql += " AND lower(tags) LIKE ?"; p.push("%" + input.tag.toLowerCase() + "%"); }
      if (input.query) { sql += " AND lower(text) LIKE ?"; p.push("%" + input.query.toLowerCase() + "%"); }
      if (input.dueOnly) sql += " AND due IS NOT NULL";
      sql += " ORDER BY (due IS NULL), due LIMIT 80";
      return db.prepare(sql).all(...p);
    }
    if (name === "search_emails") {
      let sql = "SELECT id,account,sender,sender_addr,subject,snippet,triage_tier,category,priority,received_at FROM emails WHERE 1=1"; const p = [];
      if (!input.includeHandled) sql += " AND handled=0";
      if (input.category) { sql += " AND lower(category)=lower(?)"; p.push(input.category); }
      if (input.tier) { sql += " AND triage_tier=?"; p.push(input.tier); }
      if (input.priorityOnly) sql += " AND (priority=1 OR (priority IS NULL AND triage_tier='act'))";
      if (input.query) { sql += " AND (lower(subject) LIKE ? OR lower(sender) LIKE ? OR lower(snippet) LIKE ?)"; const q = "%" + input.query.toLowerCase() + "%"; p.push(q, q, q); }
      sql += " ORDER BY datetime(received_at) DESC LIMIT 40";
      return db.prepare(sql).all(...p);
    }
    if (name === "list_projects") return getProjects().map((x) => ({ name: x.name, tag: x.tag, open: x.open, total: x.total, pct: x.pct, next: x.next }));
    if (name === "list_calendar") {
      const days = input.days || 14;
      const min = new Date().toISOString(); const max = new Date(Date.now() + days * 86400e3).toISOString();
      let evs = [];
      for (const acc of ["personal", "work"]) { try { evs = evs.concat((await listEvents(acc, min, max)).map((e) => ({ account: acc, summary: e.summary, start: (e.start && (e.start.dateTime || e.start.date)) || "", location: e.location || "" }))); } catch {} }
      const due = getDueTasks(min.slice(0, 10), max.slice(0, 10)).map((t) => ({ task: t.text, due: t.due }));
      return { events: evs.sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 40), dueTasks: due };
    }
    if (name === "read_email") return { id: input.id, body: await getBody(input.account, input.id) };
    if (name === "search_gmail") {
      const accts = input.account && input.account !== "both" ? [input.account] : ["personal", "work"];
      let rows = []; for (const a of accts) { try { rows = rows.concat(await searchMail(a, input.query, 10)); } catch (e) { rows.push({ error: a + ": " + e.message }); } }
      return rows.slice(0, 16);
    }
  } catch (e) { return { error: e.message }; }
  return { error: "unknown tool" };
}

export async function assistantTurn({ history = [], message, today }) {
  const system =
    `You are Kurt's Command Center assistant. Answer his questions using his real dashboard data via the tools — never guess. ` +
    `Today is ${today} (America/New_York). Email life-categories are: ${BUCKETS.join(", ")}. ` +
    `Call tools to get the facts, then answer concisely and specifically (cite counts, names, dates, senders). ` +
    `Use get_overview for "how many / what's my status" questions; search_tasks/search_emails for specifics; list_calendar for schedule; read_email/search_gmail only when you need detail not in the cache. ` +
    `If the data doesn't contain the answer, say so plainly. You are read-only — to take an action (add event, mark priority), tell Kurt where to do it. ` +
    `Reply in plain conversational text — short paragraphs and simple "- " bullets. Do NOT use markdown tables, headers (#), or bold (**). Keep it tight.`;

  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: "user", content: message });
  let finalText = "";

  for (let step = 0; step < 6; step++) {
    const resp = await client().messages.create({ model: SMART, max_tokens: 1600, system, tools: TOOLS, messages });
    const toolUses = (resp.content || []).filter((b) => b.type === "tool_use");
    finalText = (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (resp.stop_reason !== "tool_use" || !toolUses.length) break;
    messages.push({ role: "assistant", content: resp.content });
    const results = [];
    for (const tu of toolUses) results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(await runTool(tu.name, tu.input)) });
    messages.push({ role: "user", content: results });
  }
  return { reply: finalText || "I couldn't find anything for that." };
}
