import { test } from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { detectFormat, parseChatGptExport, parseClaudeExport, parsePlainText, selectRecent } from "../lib/coachImport.js";

// --- fixtures ---
const chatgptConversations = [
  {
    title: "Trip planning",
    create_time: 1700000100, // seconds
    mapping: {
      root: { id: "root", parent: null, children: ["m1"] },
      m1: { id: "m1", parent: "root", children: ["m2"], message: { author: { role: "user" }, content: { parts: ["Plan a trip to Japan"] } } },
      m2: { id: "m2", parent: "m1", children: [], message: { author: { role: "assistant" }, content: { parts: ["Start with Tokyo..."] } } },
    },
  },
  {
    title: "Older chat",
    create_time: 1600000000,
    mapping: { root: { id: "root", parent: null, children: ["a"] }, a: { id: "a", parent: "root", children: [], message: { author: { role: "user" }, content: { parts: ["hello"] } } } },
  },
];
const claudeConversations = [
  { name: "Career talk", created_at: "2024-05-01T10:00:00Z", chat_messages: [
    { sender: "human", text: "Should I switch jobs?" },
    { sender: "assistant", text: "Let's weigh it..." },
  ] },
];
const chatgptZip = () => { const z = new AdmZip(); z.addFile("conversations.json", Buffer.from(JSON.stringify(chatgptConversations))); return z.toBuffer(); };

test("detectFormat: zip→chatgpt, mapping-json→chatgpt, chat_messages-json→claude, else text", () => {
  assert.equal(detectFormat("export.zip", chatgptZip()), "chatgpt");
  assert.equal(detectFormat("conversations.json", Buffer.from(JSON.stringify(chatgptConversations))), "chatgpt");
  assert.equal(detectFormat("data.json", Buffer.from(JSON.stringify(claudeConversations))), "claude");
  assert.equal(detectFormat("notes.txt", Buffer.from("just some notes")), "text");
});

test("parseChatGptExport walks the mapping tree into ordered turns (zip and raw json)", () => {
  for (const buf of [chatgptZip(), Buffer.from(JSON.stringify(chatgptConversations))]) {
    const items = parseChatGptExport(buf);
    assert.equal(items.length, 2);
    assert.equal(items[0].title, "Trip planning");
    assert.match(items[0].text, /User: Plan a trip to Japan\nAssistant: Start with Tokyo/);
    assert.equal(items[0].createdAt, 1700000100 * 1000);
  }
});

test("parseClaudeExport maps chat_messages", () => {
  const items = parseClaudeExport(Buffer.from(JSON.stringify(claudeConversations)));
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Career talk");
  assert.match(items[0].text, /User: Should I switch jobs\?\nAssistant: Let's weigh it/);
  assert.ok(items[0].createdAt > 0);
});

test("parsePlainText: one item titled by filename", () => {
  const items = parsePlainText(Buffer.from("my note"), "diary.txt");
  assert.deepEqual(items.map((i) => i.title), ["diary.txt"]);
  assert.equal(items[0].text, "my note");
});

test("selectRecent sorts newest-first and caps", () => {
  const picked = selectRecent([{ createdAt: 1 }, { createdAt: 3 }, { createdAt: 2 }], 2);
  assert.deepEqual(picked.map((i) => i.createdAt), [3, 2]);
});
