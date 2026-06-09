import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText, parseMaterialRow } from "../lib/coachKnowledge.js";

test("chunkText splits at the size with no chunk over and rejoins to the original", () => {
  const text = "a".repeat(10) + "b".repeat(10) + "c".repeat(5);
  const chunks = chunkText(text, 10);
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((c) => c.length <= 10));
  assert.equal(chunks.join(""), text);
});

test("chunkText: short text is one chunk; empty is none", () => {
  assert.deepEqual(chunkText("hi", 10), ["hi"]);
  assert.deepEqual(chunkText("", 10), []);
});

test("parseMaterialRow surfaces type, defaulting to material", () => {
  assert.equal(parseMaterialRow({ id: 1, type: "personal", analyzed: 1 }).type, "personal");
  assert.equal(parseMaterialRow({ id: 2, analyzed: 0 }).type, "material");
});
