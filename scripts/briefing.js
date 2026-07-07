// Cron: regenerate the briefing. `node scripts/briefing.js --primary` for the 7:30 AM run.
import "dotenv/config";
import { syncAll } from "../lib/sync.js";
import { generateBriefing, briefingToHtml } from "../lib/briefing.js";
import { sendSelf } from "../lib/google.js";

const primary = process.argv.includes("--primary");
try {
  // freshen the cache first so the briefing reflects current mail/tasks
  const s = await syncAll();
  console.log("sync:", JSON.stringify(s));
  const b = await generateBriefing({ primary });
  console.log(`briefing generated (${primary ? "PRIMARY" : "hourly"}):`, b.priorities?.length || 0, "priorities,", b.clusters?.length || 0, "clusters");

  // Deliver the primary (7:30) briefing to Kurt's own inbox — opt-in via BRIEFING_EMAIL=on.
  if (primary && process.env.BRIEFING_EMAIL === "on") {
    try {
      const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      await sendSelf("personal", `☀ Your briefing — ${dateLabel}`, briefingToHtml(b, dateLabel));
      console.log("briefing emailed to personal inbox");
    } catch (e) {
      console.error("briefing email failed (non-fatal):", e.message);
    }
  }
  process.exit(0);
} catch (e) {
  console.error("briefing failed:", e.message);
  process.exit(1);
}
