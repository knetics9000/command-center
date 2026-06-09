import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMaterialRow } from "../lib/coachKnowledge.js";

test("parseMaterialRow parses JSON array columns and maps fields", () => {
  const dto = parseMaterialRow({
    id: 7, url: "https://youtu.be/x", kind: "video", title: "t", text: null,
    ai_title: "Real Title", summary: "sum", categories: '["Tutorial","AI"]',
    takeaways: '["a","b"]', insights: "[]", tools: '["Claude"]', people: "[]",
    credibility: 80, cred_reason: "reputable", influence_id: 3, influence_name: "Huberman",
    source: "share", analyzed: 1, created_at: 123,
  });
  assert.equal(dto.aiTitle, "Real Title");
  assert.deepEqual(dto.categories, ["Tutorial", "AI"]);
  assert.deepEqual(dto.takeaways, ["a", "b"]);
  assert.equal(dto.influenceName, "Huberman");
  assert.equal(dto.analyzed, true);
});

test("parseMaterialRow tolerates malformed/empty arrays and null row", () => {
  assert.equal(parseMaterialRow(null), null);
  const dto = parseMaterialRow({ id: 1, categories: "not json", takeaways: null, analyzed: 0 });
  assert.deepEqual(dto.categories, []);
  assert.deepEqual(dto.takeaways, []);
  assert.equal(dto.analyzed, false);
});
