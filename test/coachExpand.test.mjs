import { test } from "node:test";
import assert from "node:assert/strict";
import { pickValidIds, sourceLabel } from "../lib/coachExpand.js";

test("pickValidIds keeps order, drops unknown ids, caps at k", () => {
  assert.deepEqual(pickValidIds([3, 99, 1, 2, 4], new Set([1, 2, 3, 4]), 3), [3, 1, 2]);
  assert.deepEqual(pickValidIds([], new Set([1]), 5), []);
  assert.deepEqual(pickValidIds(["2", 2, 2], new Set([2]), 5), [2]); // coerces strings, dedupes
});

test("sourceLabel: material with guru, material plain, personal", () => {
  assert.equal(sourceLabel({ type: "material", aiTitle: "Deep Work", influenceName: "Newport" }), "Deep Work — Newport");
  assert.equal(sourceLabel({ type: "material", aiTitle: "Some Article", influenceName: null }), "Some Article");
  assert.equal(sourceLabel({ type: "personal", aiTitle: "Career talk" }), "My history: Career talk");
  assert.equal(sourceLabel({ type: "material", aiTitle: null, title: null, url: "https://x.com" }), "https://x.com");
});
