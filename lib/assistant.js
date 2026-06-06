// Command Center assistant: a Claude tool-use loop that answers Kurt's questions
// by querying his real dashboard data (tasks, emails, priorities, categories,
// projects, calendar) — plus live Gmail/Calendar when the cache isn't enough.
import Anthropic from "@anthropic-ai/sdk";
import { SMART } from "./claude.js";
import { getDb } from "./db.js";
import { getStats, getProjects, getDueTasks, getBucketSummary, tagsOf } from "./queries.js";
import { getPriorityInbox, recordFeedback } from "./priority.js";
import { searchMail, getBody, listEvents, archiveMsg, createEvent } from "./google.js";
import { addTask } from "./offload.js";
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
  {
    name: "propose_actions",
    description: "Propose actions for Kurt to CONFIRM. Never executes — Kurt approves each. Use when he asks you to do something (mark priority, archive, add an event, add a task). Gather any needed ids first via the search tools.",
    input_schema: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["mark_priority", "mark_not_priority", "archive", "add_event", "add_task"] },
              label: { type: "string", description: "human-readable description of this action" },
              emailId: { type: "string" }, account: { type: "string", enum: ["personal", "work"] },
              title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM or ''" }, allDay: { type: "boolean" },
              text: { type: "string" }, tag: { type: "string" },
            },
            required: ["type", "label"],
          },
        },
      },
      required: ["actions"],
    },
  },
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
    `If the data doesn't contain the answer, say so plainly. ` +
    `When Kurt asks you to DO something — mark email(s) priority or not, archive email(s), add a calendar event, or add a task — first gather any needed email ids via the search tools, then call propose_actions with concrete actions. NEVER claim an action is done; Kurt confirms each one. Only propose what he asked for. ` +
    `Reply in plain conversational text — short paragraphs and simple "- " bullets. Do NOT use markdown tables, headers (#), or bold (**). Keep it tight.`;

  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: "user", content: message });
  let finalText = "";
  const proposed = [];

  for (let step = 0; step < 6; step++) {
    const resp = await client().messages.create({ model: SMART, max_tokens: 1600, system, tools: TOOLS, messages });
    const toolUses = (resp.content || []).filter((b) => b.type === "tool_use");
    finalText = (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (resp.stop_reason !== "tool_use" || !toolUses.length) break;
    messages.push({ role: "assistant", content: resp.content });
    const results = [];
    for (const tu of toolUses) {
      if (tu.name === "propose_actions") {
        for (const a of (tu.input.actions || [])) proposed.push(a);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ ok: true, proposed: (tu.input.actions || []).length, note: "Shown to Kurt for confirmation." }) });
      } else {
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(await runTool(tu.name, tu.input)) });
      }
    }
    messages.push({ role: "user", content: results });
  }
  if (!finalText) finalText = proposed.length ? `I've prepared ${proposed.length} action(s) — confirm below to apply.` : "I couldn't find anything for that.";
  return { reply: finalText, proposedActions: proposed };
}

/** Executes confirmed actions (Kurt clicked Confirm). */
export async function executeActions(actions = []) {
  const db = getDb();
  const results = [];
  for (const a of actions) {
    try {
      if (a.type === "mark_priority" || a.type === "mark_not_priority") {
        const pr = a.type === "mark_priority" ? 1 : 0;
        const e = db.prepare("SELECT sender_addr FROM emails WHERE id=?").get(a.emailId);
        db.prepare("UPDATE emails SET priority=?, updated_at=datetime('now') WHERE id=?").run(pr, a.emailId);
        if (e) recordFeedback(e.sender_addr, pr);
        results.push({ ok: true, label: a.label });
      } else if (a.type === "archive") {
        const e = db.prepare("SELECT account FROM emails WHERE id=?").get(a.emailId);
        await archiveMsg(a.account || (e && e.account), a.emailId);
        db.prepare("UPDATE emails SET handled=1, handled_state='archived', snooze_until=NULL WHERE id=?").run(a.emailId);
        results.push({ ok: true, label: a.label });
      } else if (a.type === "add_event") {
        const allDay = a.allDay || !a.time;
        let start = a.date, end;
        if (!allDay) { start = new Date(`${a.date}T${a.time}:00`).toISOString(); end = new Date(new Date(start).getTime() + 3600000).toISOString(); }
        const ev = await createEvent("personal", { summary: a.title, allDay, start, end });
        db.prepare("INSERT INTO calendar_events (gcal_event_id,calendar_account,title,start,end,source) VALUES (?,?,?,?,?, 'assistant')").run(ev.id, "personal", a.title, allDay ? a.date : start, end || "");
        results.push({ ok: true, label: a.label });
      } else if (a.type === "add_task") {
        await addTask(a.text, a.tag || "");
        results.push({ ok: true, label: a.label });
      } else results.push({ ok: false, label: a.label, error: "unknown action" });
    } catch (e) { results.push({ ok: false, label: a.label, error: e.message }); }
  }
  return results;
}
