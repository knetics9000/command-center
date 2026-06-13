// Browser-facing triage API (behind the site's basic-auth wall via Caddy).
// The dashboard widget lists notifications and acts on them.
import { NextResponse } from "next/server";
import { listNotifications, dismissNotification, snoozeNotification, notificationToTask } from "@/lib/notify";
import { dedupeNotifications } from "@/lib/dedupe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try { dedupeNotifications(); } catch {}   // self-clean any duplicate pile-up before listing
  return NextResponse.json({ ok: true, notifications: listNotifications() });
}

export async function POST(req) {
  try {
    const b = await req.json();
    if (b.action === "dismiss") return NextResponse.json(dismissNotification(b.id));
    if (b.action === "snooze") return NextResponse.json(snoozeNotification(b.id, b.hours, b.until));
    if (b.action === "task") return NextResponse.json(await notificationToTask(b.id));
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
