// Initialize / migrate the SQLite database. Safe to run repeatedly.
import "dotenv/config";
import { getDb } from "../lib/db.js";

const db = getDb();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);

console.log("DB ready at", process.env.DATABASE_PATH || "./data/command-center.db");
console.log("Tables (" + tables.length + "):", tables.join(", "));
