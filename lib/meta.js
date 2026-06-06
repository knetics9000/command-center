// Tiny key/value store for harness state (e.g. the watcher's change fingerprint).
import { getDb } from "./db.js";

export function getMeta(key) {
  const r = getDb().prepare("SELECT value FROM app_meta WHERE key=?").get(key);
  return r ? r.value : null;
}
export function setMeta(key, value) {
  getDb().prepare("INSERT INTO app_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, String(value));
}
