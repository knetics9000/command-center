import { NextResponse } from "next/server";
import { listEvents } from "@/lib/google";
import { getOpenTasks, getProjects, getLatestBriefing } from "@/lib/queries";
import { assembleCoachBundle } from "@/lib/coachContext";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req) {
  const token = req.headers.get("x-coach-token");
  if (!process.env.COACH_TOKEN || token !== process.env.COACH_TOKEN) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();
    // Window is in SERVER-LOCAL time — correct for a self-hosted personal deployment in the
    // user's own timezone. If ever hosted on UTC infra, "today" would be UTC midnight; add a tz param then.
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(now); endOfTomorrow.setDate(endOfTomorrow.getDate() + 2); endOfTomorrow.setHours(0, 0, 0, 0);
    const timeMin = startOfToday.toISOString();
    const timeMax = endOfTomorrow.toISOString();

    const accounts = [process.env.ACCOUNT_PERSONAL, process.env.ACCOUNT_WORK].filter(Boolean);
    const eventsByAccount = [];
    for (const account of accounts) {
      try {
        const events = await listEvents(account, timeMin, timeMax);
        eventsByAccount.push({ account, events });
      } catch {
        // skip an account that errors (not connected / token issue) — still return the rest
      }
    }

    const bundle = assembleCoachBundle({
      now: now.toISOString(),
      eventsByAccount,
      tasks: getOpenTasks(),
      projects: getProjects(),
      briefing: getLatestBriefing(),
    });
    return NextResponse.json(bundle);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
