// In-container scheduler (replaces host cron). Long-running:
//  - every 15 min: sync mail/tasks, run standing rules, and (when data changed)
//    auto-run the AI cleanup organizer + regenerate the briefing.
//  - once daily ~7:30 (container TZ): the primary briefing + self-email.
// Set TZ=America/New_York in the container so 7:30 is local.
import "dotenv/config";
import { syncAll } from "../lib/sync.js";
import { runAllRules } from "../lib/rules.js";
import { generateCleanup, dataFingerprint, cleanupCount } from "../lib/cleanup.js";
import { generateBriefing, briefingToHtml } from "../lib/briefing.js";
import { sendSelf } from "../lib/google.js";
import { getMeta, setMeta } from "../lib/meta.js";
import { processUnprocessed, captureNewOffloadTasks } from "../lib/capture.js";

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function watcherCycle() {
  const s = await syncAll();
  log("sync:", JSON.stringify(s));
  const res = await runAllRules();
  log(`rules: ${res.length} run, ${res.reduce((n, r) => n + (r.created ? r.created.length : 0), 0)} events created`);

  try { const n = await captureNewOffloadTasks(); if (n) log(`routed ${n} Offload dump(s) through the AI layer`); } catch {}
  try { const n = await processUnprocessed(); if (n) log(`processed ${n} straggler capture(s)`); } catch {}

  const fp = dataFingerprint();
  if (fp !== getMeta("data_fp")) {
    try { const c = await generateCleanup(); log(`cleanup: +${c.added} new, ${cleanupCount()} pending`); } catch (e) { log("cleanup failed:", e.message); }
    try { const b = await generateBriefing({ primary: false }); log(`briefing: ${b.priorities?.length || 0} priorities`); } catch (e) { log("briefing failed:", e.message); }
    setMeta("data_fp", fp);
  } else log("no data change — skipped cleanup + briefing");
}

async function primaryBriefing() {
  await syncAll();
  const b = await generateBriefing({ primary: true });
  log(`PRIMARY briefing: ${b.priorities?.length || 0} priorities`);
  try {
    const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    await sendSelf("personal", `☀ Your briefing — ${dateLabel}`, briefingToHtml(b, dateLabel));
    log("briefing emailed");
  } catch (e) { log("briefing email failed:", e.message); }
}

async function tick() {
  try { await watcherCycle(); } catch (e) { log("watcher cycle error:", e.message); }
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  if (now.getHours() === 7 && now.getMinutes() >= 30 && now.getMinutes() < 45 && getMeta("primary_date") !== dateKey) {
    setMeta("primary_date", dateKey);
    try { await primaryBriefing(); } catch (e) { log("primary briefing error:", e.message); }
  }
}

log("scheduler started (15-min cycle, 7:30 primary)");
tick();
setInterval(tick, 15 * 60 * 1000);
