import { test } from "node:test";
import assert from "node:assert/strict";
import { isStale, buildDigestPrompt } from "../lib/coachDigest.js";

test("isStale: no cache, count change, latestAt change, match", () => {
  assert.equal(isStale(null, { count: 2, latestAt: 10 }), true);
  assert.equal(isStale({ count: 1, latestAt: 10 }, { count: 2, latestAt: 10 }), true);
  assert.equal(isStale({ count: 2, latestAt: 9 }, { count: 2, latestAt: 10 }), true);
  assert.equal(isStale({ count: 2, latestAt: 10, digest: "d" }, { count: 2, latestAt: 10 }), false);
});

test("buildDigestPrompt includes item and guru lines, omits empty guru section", () => {
  const items = [{ aiTitle: "Career talk", summary: "Weighed a job switch.", takeaways: ["Values autonomy"], people: ["Nick"] }];
  const withGurus = buildDigestPrompt(items, [{ name: "Newport", why: "focus" }]);
  assert.match(withGurus, /Career talk/);
  assert.match(withGurus, /Weighed a job switch/);
  assert.match(withGurus, /Values autonomy/);
  assert.match(withGurus, /Newport — focus/);
  const noGurus = buildDigestPrompt(items, []);
  assert.doesNotMatch(noGurus, /GURUS/);
});
