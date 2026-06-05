// AI triage (Haiku) — 4 tiers + per-email why/action + phishing flag. Batched.
import { askJSON, FAST } from "./claude.js";

const SYSTEM =
  "You are an executive assistant triaging Kurt's email. Be decisive and concrete.";

const RULES = `For EACH email return one object:
{"id":"<id>","tier":"act"|"review"|"quick"|"noise","why":"ONE concrete short sentence (<=16 words) why it matters to Kurt","action":"short next step (<=8 words, imperative)","risk":true ONLY if phishing/fraud/scam else false,"riskWhy":"short reason or \\"\\""}
Tiers: act=needs reply/decision today; review=matters, not urgent (FYIs, receipts, reads); quick=under 2 min (confirm/verify/schedule); noise=newsletters/promos/automated alerts.
Return ONLY a JSON array, same order, no markdown.`;

/** emails: [{id,account,sender,subject,snippet}] -> { id: {tier,why,action,risk,riskWhy} } */
export async function triageEmails(emails) {
  const out = {};
  for (let i = 0; i < emails.length; i += 40) {
    const chunk = emails.slice(i, i + 40);
    const payload = chunk.map((e) => ({
      id: e.id, account: e.account, from: e.sender, subject: e.subject, preview: (e.snippet || "").slice(0, 200),
    }));
    try {
      const arr = await askJSON({
        model: FAST,
        system: SYSTEM,
        prompt: RULES + "\n\nEMAILS:\n" + JSON.stringify(payload),
      });
      for (const r of arr || []) {
        if (r && r.id)
          out[r.id] = {
            tier: ["act", "review", "quick", "noise"].includes(r.tier) ? r.tier : "review",
            why: r.why || "", action: r.action || "", risk: r.risk ? 1 : 0, riskWhy: r.riskWhy || "",
          };
      }
    } catch {
      for (const e of chunk) out[e.id] = heuristic(e);
    }
  }
  return out;
}

function heuristic(e) {
  const t = (e.subject + " " + (e.snippet || "") + " " + e.sender).toLowerCase();
  let r = { tier: "review", why: "Worth a look.", action: "Review", risk: 0, riskWhy: "" };
  if (/no-?reply|newsletter|updates@|marketing|deals|promo|unsubscribe|% off|sale/.test(t))
    r = { tier: "noise", why: "Promotional broadcast.", action: "Archive", risk: 0, riskWhy: "" };
  if (/verify|confirm|code|rsvp|schedule|reply|respond|past due|due/.test(t))
    r = { tier: "quick", why: "Quick confirmation needed.", action: "Confirm", risk: 0, riskWhy: "" };
  if (/urgent|today|asap|overdue|payment failed|final notice/.test(t))
    r = { tier: "act", why: "Time-sensitive.", action: "Handle today", risk: 0, riskWhy: "" };
  return r;
}
