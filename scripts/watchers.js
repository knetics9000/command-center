// Cron (*/15 * * * *): freshen mail/tasks, run standing rules, then — only when
// the data actually changed — auto-run the AI Cleanup organizer + regenerate the
// briefing, so fresh suggestions appear without any manual scans.
import "dotenv/config";
import { syncAll } from "../lib/sync.js";
import { runAllRules } from "../lib/rules.js";
import { generateCleanup, dataFingerprint, cleanupCount } from "../lib/cleanup.js";
import { generateBriefing } from "../lib/briefing.js";
import { getMeta, setMeta } from "../lib/meta.js";
import { captureNewOffloadTasks, processUnprocessed } from "../lib/capture.js";
import { dedupeAll } from "../lib/dedupe.js";
import { analyzeNotifications } from "../lib/notify.js";

try {
  const s = await syncAll();
  console.log("sync:", JSON.stringify(s));

  const res = await runAllRules();
  const total = res.reduce((n, r) => n + (r.created ? r.created.length : 0), 0);
  console.log(`rules run: ${res.length}, events created: ${total}`);
  for (const r of res) console.log(`  rule ${r.ruleId}: ${r.error ? "ERROR " + r.error : (r.created?.length || 0) + " created — " + (r.summary || "")}`);

  try { const n = await captureNewOffloadTasks(); if (n) console.log(`routed ${n} Offload dump(s) through the AI layer`); } catch {}
  try { const n = await processUnprocessed(); if (n) console.log(`processed ${n} straggler capture(s)`); } catch {}
  try { const d = dedupeAll(); const t = d.notifications + d.captures + d.shared; if (t) console.log(`deduped: ${d.notifications} notifs, ${d.captures} captures, ${d.shared} shared`); } catch {}
  try { let n = 0; while (await analyzeNotifications(15)) { n += 15; if (n >= 90) break; } if (n) console.log(`analyzed phone notifications`); } catch {}

  // Auto-organize + re-brief only when something changed (saves API calls; keeps the briefing delta meaningful).
  const fp = dataFingerprint();
  if (fp !== getMeta("data_fp")) {
    try { const c = await generateCleanup(); console.log(`cleanup: +${c.added} new, ${cleanupCount()} pending`); }
    catch (e) { console.error("cleanup failed:", e.message); }
    try { const b = await generateBriefing({ primary: false }); console.log(`briefing regenerated: ${b.priorities?.length || 0} priorities, ${b.clusters?.length || 0} clusters`); }
    catch (e) { console.error("briefing failed:", e.message); }
    setMeta("data_fp", fp);
  } else {
    console.log("no data change — skipped cleanup + briefing");
  }
  process.exit(0);
} catch (e) {
  console.error("watcher failed:", e.message);
  process.exit(1);
}
