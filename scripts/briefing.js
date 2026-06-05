// Cron: regenerate the briefing. `node scripts/briefing.js --primary` for the 7:30 AM run.
import "dotenv/config";
import { syncAll } from "../lib/sync.js";
import { generateBriefing } from "../lib/briefing.js";

const primary = process.argv.includes("--primary");
try {
  // freshen the cache first so the briefing reflects current mail/tasks
  const s = await syncAll();
  console.log("sync:", JSON.stringify(s));
  const b = await generateBriefing({ primary });
  console.log(`briefing generated (${primary ? "PRIMARY" : "hourly"}):`, b.priorities?.length || 0, "priorities,", b.clusters?.length || 0, "clusters");
  process.exit(0);
} catch (e) {
  console.error("briefing failed:", e.message);
  process.exit(1);
}
