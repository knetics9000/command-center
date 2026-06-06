import { getDb } from "./db.js";

// Edit these (or the habit_template table) to change Kurt's habits.
const STARTER = [
  { id: "workout", name: "Morning workout", subtasks: [{ id: "warmup", label: "Warm-up" }, { id: "main", label: "Main set" }, { id: "stretch", label: "Stretch" }] },
  { id: "read", name: "Read / learn (30 min)", subtasks: [{ id: "read", label: "30 focused minutes" }] },
  { id: "supplements", name: "Take supplements", subtasks: [{ id: "am", label: "Morning" }, { id: "pm", label: "Evening" }] },
  { id: "review", name: "Review tasks & priorities", subtasks: [{ id: "inbox", label: "Clear the inbox" }, { id: "top3", label: "Set today's top 3" }] },
  { id: "winddown", name: "Evening wind-down / journal", subtasks: [{ id: "noscreens", label: "Screens off 30 min" }, { id: "journal", label: "Journal" }] },
];

export const todayLocal = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the container TZ

export function seedHabitsIfEmpty() {
  const db = getDb();
  if (db.prepare("SELECT COUNT(*) c FROM habit_template").get().c) return;
  const ins = db.prepare("INSERT INTO habit_template (id,name,subtasks,sort_order) VALUES (?,?,?,?)");
  STARTER.forEach((h, i) => ins.run(h.id, h.name, JSON.stringify(h.subtasks), i));
}

export function getTemplate() {
  seedHabitsIfEmpty();
  return getDb().prepare("SELECT id,name,subtasks FROM habit_template ORDER BY sort_order, name").all()
    .map((r) => ({ id: r.id, name: r.name, subtasks: JSON.parse(r.subtasks || "[]") }));
}

export function getEntry(date) {
  const db = getDb();
  const r = db.prepare("SELECT data FROM habit_entries WHERE date=?").get(date);
  if (r) return JSON.parse(r.data || "{}");
  db.prepare("INSERT INTO habit_entries (date,data) VALUES (?, '{}')").run(date);
  return {};
}

export function saveEntry(date, data) {
  getDb().prepare("INSERT INTO habit_entries (date,data,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(date) DO UPDATE SET data=excluded.data, updated_at=datetime('now')")
    .run(date, JSON.stringify(data || {}));
}

/** Did Kurt complete each habit yesterday? Used by the morning brief later. */
export function completionFor(date) {
  const tmpl = getTemplate();
  const data = getDb().prepare("SELECT data FROM habit_entries WHERE date=?").get(date);
  const d = data ? JSON.parse(data.data || "{}") : {};
  let doneHabits = 0;
  for (const h of tmpl) {
    const st = d[h.id] || {};
    if (h.subtasks.length && h.subtasks.every((s) => st[s.id])) doneHabits++;
  }
  return { total: tmpl.length, done: doneHabits };
}
