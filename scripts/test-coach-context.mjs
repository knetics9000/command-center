import assert from "node:assert";
import { assembleCoachBundle } from "../lib/coachContext.js";

// merge + sort across accounts; all-day + timed; drop start-less
const b = assembleCoachBundle({
  now: "2026-06-08T09:00:00-04:00",
  eventsByAccount: [
    { account: "work", events: [{ summary: "Marcus call", location: "Zoom", start: { dateTime: "2026-06-08T15:00:00-04:00" }, end: { dateTime: "2026-06-08T15:30:00-04:00" } }] },
    { account: "personal", events: [
      { summary: "Dentist", start: { dateTime: "2026-06-08T10:00:00-04:00" }, end: { dateTime: "2026-06-08T10:45:00-04:00" } },
      { summary: "No start", end: { dateTime: "2026-06-08T11:00:00-04:00" } },
    ] },
  ],
  tasks: [
    { id: "a", text: "Pay rent", due: "2026-06-10", created_at: "2026-06-01" },
    { id: "b", text: "No due", due: null, created_at: "2026-06-07" },
    { id: "c", text: "Due first", due: "2026-06-09", created_at: "2026-06-02" },
  ],
  projects: [
    { name: "i9 Sports", tag: "i9 Project", open: 3, next: "Email coach" },
    { name: "Empty", tag: "Empty Project", open: 0, next: null },
  ],
  briefing: { generated_at: "2026-06-08T07:30:00", greeting: "Busy morning", priorities: [{ title: "Call Marcus" }, { title: "Pay rent" }] },
});

assert.equal(b.calendar.length, 2, "start-less event dropped");
assert.equal(b.calendar[0].title, "Dentist", "sorted by start: 10am before 3pm");
assert.equal(b.calendar[1].account, "work");
assert.deepEqual(b.openTasks.map((t) => t.id), ["c", "a", "b"], "due-soonest first, undated last");
assert.equal(b.activeProjects.length, 1, "only projects with open>0");
assert.equal(b.activeProjects[0].name, "i9 Sports");
assert.equal(b.latestBriefing.summary, "Busy morning · Call Marcus · Pay rent");
console.log("OK: assembleCoachBundle");
