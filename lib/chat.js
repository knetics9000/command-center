// Per-project assistant: a Claude tool-use loop that can search/read Kurt's mail
// across both accounts and PROPOSE calendar events. It never creates events —
// proposals come back to the UI for explicit confirmation (the irreversible step).
import Anthropic from "@anthropic-ai/sdk";
import { SMART } from "./claude.js";
import { searchMail, getBody } from "./google.js";

let _c;
const client = () => (_c = _c || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const TOOLS = [
  {
    name: "search_email",
    description: "Search Kurt's Gmail (both accounts unless one is specified). Use Gmail search syntax. Returns id, from, subject, date, snippet.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query, e.g. 'i9 sports schedule' or 'from:coach'" },
        account: { type: "string", enum: ["personal", "work", "both"], description: "Which mailbox (default both)" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_email",
    description: "Read the full body of one email to extract exact times, dates, addresses, or names.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" }, account: { type: "string", enum: ["personal", "work"] } },
      required: ["id", "account"],
    },
  },
  {
    name: "propose_events",
    description: "Propose one or more calendar events for Kurt to confirm. Does NOT create them. Call this once you have concrete date/time details.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              summary: { type: "string" },
              location: { type: "string" },
              start: { type: "string", description: "ISO 8601 with offset, e.g. 2026-06-14T10:00:00-04:00" },
              end: { type: "string", description: "ISO 8601 with offset" },
            },
            required: ["summary", "start", "end"],
          },
        },
      },
      required: ["events"],
    },
  },
];

async function runTool(name, input) {
  if (name === "search_email") {
    const accts = input.account && input.account !== "both" ? [input.account] : ["personal", "work"];
    let rows = [];
    for (const a of accts) {
      try { rows = rows.concat(await searchMail(a, input.query, 10)); } catch (e) { rows.push({ error: `${a}: ${e.message}` }); }
    }
    return rows.slice(0, 16);
  }
  if (name === "read_email") {
    try { return { id: input.id, body: await getBody(input.account, input.id) }; }
    catch (e) { return { error: e.message }; }
  }
  if (name === "propose_events") return { ok: true, shown: (input.events || []).length };
  return { error: "unknown tool" };
}

/**
 * history: [{role:'user'|'assistant', content:string}]
 * returns { reply, proposedEvents:[{summary,location,start,end}] }
 */
export async function chatTurn({ projectName, history = [], message, today }) {
  const system =
    `You are Kurt's executive assistant for the "${projectName}" project. Today is ${today} (timezone America/New_York). ` +
    `You can search and read his email across both accounts, and propose calendar events. ` +
    `When he asks you to track schedules (games, practices, appointments), search his mail, read the relevant messages, extract exact dates/times/addresses, and call propose_events with concrete ISO datetimes (America/New_York offset). ` +
    `ALWAYS search his email before answering questions about schedules or message contents — don't answer from memory. After acting, ALWAYS end with a brief plain-text summary of what you found (even if nothing). ` +
    `NEVER claim you created an event — you only propose; he confirms. If details are ambiguous or missing, ask one concise clarifying question instead of guessing. Be brief and concrete.`;

  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: "user", content: message });

  const proposed = [];
  let finalText = "";

  for (let step = 0; step < 6; step++) {
    const resp = await client().messages.create({ model: SMART, max_tokens: 2000, system, tools: TOOLS, messages });
    const toolUses = (resp.content || []).filter((b) => b.type === "tool_use");
    finalText = (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();

    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: resp.content });
    const results = [];
    for (const tu of toolUses) {
      if (tu.name === "propose_events") for (const e of tu.input.events || []) proposed.push(e);
      const out = await runTool(tu.name, tu.input);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    messages.push({ role: "user", content: results });
  }

  if (!finalText)
    finalText = proposed.length
      ? `I found ${proposed.length} event(s) — confirm below to add them to your calendar.`
      : "I searched your email but didn't find concrete dates/times to add yet. If they'll arrive later, I can set a standing rule to add them automatically when they come in.";
  return { reply: finalText, proposedEvents: proposed };
}
