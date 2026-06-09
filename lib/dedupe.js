// System-wide duplicate removal. Apps (YouTube, etc.) re-post the same
// notification on every update, and brain-dumps / shared links can pile up
// identically. This sweeps the local stores, keeping one of each.
//
// Tasks are intentionally NOT touched here — they sync with Offload, so their
// duplicates are surfaced (not auto-deleted) by the AI Cleanup organizer.
import { getDb } from "./db.js";

/** Collapse identical active notifications (same app + title + body) to the newest. */
export function dedupeNotifications() {
  const r = getDb().prepare(`
    DELETE FROM notifications
    WHERE status IN ('new','snoozed')
      AND id NOT IN (
        SELECT MAX(id) FROM notifications
        WHERE status IN ('new','snoozed')
        GROUP BY app, COALESCE(title,''), COALESCE(body,'')
      )
  `).run();
  return r.changes;
}

/** Collapse identical open captures (same trimmed/lowercased text) to the earliest. */
export function dedupeCaptures() {
  const r = getDb().prepare(`
    DELETE FROM captures
    WHERE done=0
      AND id NOT IN (
        SELECT MIN(id) FROM captures
        WHERE done=0
        GROUP BY lower(trim(raw_text))
      )
  `).run();
  return r.changes;
}

/** Collapse shared items pointing at the same URL to the newest. */
export function dedupeSharedItems() {
  const r = getDb().prepare(`
    DELETE FROM shared_items
    WHERE COALESCE(url,'') <> ''
      AND id NOT IN (
        SELECT MAX(id) FROM shared_items
        WHERE COALESCE(url,'') <> ''
        GROUP BY url
      )
  `).run();
  return r.changes;
}

export function dedupeAll() {
  return {
    notifications: dedupeNotifications(),
    captures: dedupeCaptures(),
    shared: dedupeSharedItems(),
  };
}
