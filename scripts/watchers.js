// Cron (*/15 * * * *): freshen mail/tasks, then run every enabled standing rule.
import "dotenv/config";
import { syncAll } from "../lib/sync.js";
import { runAllRules } from "../lib/rules.js";

try {
  const s = await syncAll();
  console.log("sync:", JSON.stringify(s));
  const res = await runAllRules();
  const total = res.reduce((n, r) => n + (r.created ? r.created.length : 0), 0);
  console.log(`rules run: ${res.length}, events created: ${total}`);
  for (const r of res) console.log(`  rule ${r.ruleId}: ${r.error ? "ERROR " + r.error : (r.created?.length || 0) + " created — " + (r.summary || "")}`);
  process.exit(0);
} catch (e) {
  console.error("watcher failed:", e.message);
  process.exit(1);
}
