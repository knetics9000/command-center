import AdmZip from "adm-zip";
import { insertMaterial, analyzeGuruMaterial } from "./coachKnowledge.js";

const isZip = (buffer) => buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"

/** 'chatgpt' (zip or conversations.json) | 'claude' (conversations json) | 'text'. */
export function detectFormat(filename, buffer) {
  if (isZip(buffer)) return "chatgpt"; // the only zip we accept is a ChatGPT export
  try {
    const parsed = JSON.parse(buffer.toString("utf8"));
    if (Array.isArray(parsed) && parsed.length) {
      if (parsed[0]?.mapping) return "chatgpt";
      if (parsed[0]?.chat_messages) return "claude";
    }
  } catch {}
  return "text";
}

/** Walk a ChatGPT conversation's mapping tree (root → first child chain) into "Role: text" lines. */
function walkMapping(mapping) {
  const rootId = Object.keys(mapping).find((k) => !mapping[k]?.parent);
  const lines = [];
  let cur = rootId;
  let steps = Object.keys(mapping).length; // a corrupt/cyclic mapping must not block the event loop
  while (cur && steps-- > 0) {
    const node = mapping[cur];
    const msg = node?.message;
    const role = msg?.author?.role;
    const parts = msg?.content?.parts;
    if ((role === "user" || role === "assistant") && Array.isArray(parts)) {
      const text = parts.filter((p) => typeof p === "string").join("\n").trim();
      if (text) lines.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);
    }
    cur = node?.children?.[0];
  }
  return lines.join("\n");
}

/** ChatGPT export: a .zip containing conversations.json, or that json directly. → [{title,text,createdAt}] */
export function parseChatGptExport(buffer) {
  let json = buffer;
  if (isZip(buffer)) {
    const entry = new AdmZip(buffer).getEntries().find((e) => e.entryName.endsWith("conversations.json"));
    if (!entry) throw new Error("no conversations.json in the zip");
    json = entry.getData();
  }
  const conversations = JSON.parse(json.toString("utf8"));
  if (!Array.isArray(conversations)) throw new Error("unexpected ChatGPT export shape");
  return conversations
    .map((c) => ({
      title: c.title || "ChatGPT conversation",
      text: walkMapping(c.mapping || {}),
      createdAt: Math.round((c.create_time || 0) * 1000),
    }))
    .filter((i) => i.text);
}

/** Claude export: conversations json with chat_messages. → [{title,text,createdAt}] */
export function parseClaudeExport(buffer) {
  const conversations = JSON.parse(buffer.toString("utf8"));
  if (!Array.isArray(conversations)) throw new Error("unexpected Claude export shape");
  return conversations
    .map((c) => ({
      title: c.name || "Claude conversation",
      text: (c.chat_messages || [])
        .map((m) => {
          const text = m.text || (Array.isArray(m.content) ? m.content.map((b) => b?.text || "").join("\n") : "");
          return text ? `${m.sender === "human" ? "User" : "Assistant"}: ${text}` : null;
        })
        .filter(Boolean)
        .join("\n"),
      createdAt: Date.parse(c.created_at) || 0,
    }))
    .filter((i) => i.text);
}

export function parsePlainText(buffer, filename) {
  const text = buffer.toString("utf8").trim();
  return text ? [{ title: filename || "Imported note", text, createdAt: Date.now() }] : [];
}

/** Pure: newest-first, capped. */
export function selectRecent(items, cap) {
  return [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, cap);
}

/** Insert the recent-N as personal materials and fire async analysis on each. Returns {count}. */
export function importConversations(items, { cap = 100 } = {}) {
  const picked = selectRecent(items, cap);
  for (const item of picked) {
    const id = insertMaterial({ title: item.title, text: item.text, type: "personal", source: "import" });
    analyzeGuruMaterial(id).catch(() => {});
  }
  return { count: picked.length };
}
