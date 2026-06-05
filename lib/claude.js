// Claude API client. Haiku for parse/extract/triage, Sonnet for briefing reasoning + chat.
import Anthropic from "@anthropic-ai/sdk";

let _client;
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export const FAST = process.env.CLAUDE_MODEL_FAST || "claude-haiku-4-5";
export const SMART = process.env.CLAUDE_MODEL_SMART || "claude-sonnet-4-6";

/** Low-level call; returns concatenated text. messages = [{role,content}]. */
export async function ask({ model, system, messages, max_tokens = 1500, temperature = 0.3 }) {
  const r = await client().messages.create({ model, max_tokens, temperature, system, messages });
  return (r.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
}

export function askFast(prompt, system) {
  return ask({ model: FAST, system, messages: [{ role: "user", content: prompt }], max_tokens: 2000 });
}
export function askSmart(prompt, system) {
  return ask({ model: SMART, system, messages: [{ role: "user", content: prompt }], max_tokens: 2500 });
}

/** Ask for JSON and parse it, tolerating prose/markdown around it. */
export async function askJSON({ model, system, prompt, max_tokens = 2500 }) {
  const out = await ask({ model, system, messages: [{ role: "user", content: prompt }], max_tokens });
  const a = out.indexOf("["), b = out.lastIndexOf("]");
  const c = out.indexOf("{"), d = out.lastIndexOf("}");
  let slice = out;
  if (a >= 0 && b > a && (c < 0 || a < c)) slice = out.slice(a, b + 1);
  else if (c >= 0 && d > c) slice = out.slice(c, d + 1);
  return JSON.parse(slice);
}
