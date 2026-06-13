// Kids co-parent inbox: board for the widget + actions.
import { NextResponse } from "next/server";
import { kidsBoard, markKidSeen, markAllKidSeen, kidToCalendar, promoteKidEmail, snoozeKidEmail, syncCoparent } from "@/lib/coparent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ ok: true, ...kidsBoard() });
}

export async function POST(req) {
  try {
    const b = await req.json();
    if (b.action === "seen") { markKidSeen(b.id, b.seen ?? 1); return NextResponse.json({ ok: true }); }
    if (b.action === "promote") { promoteKidEmail(b.id); return NextResponse.json({ ok: true, ...kidsBoard() }); }
    if (b.action === "snooze") { snoozeKidEmail(b.id, b.until); return NextResponse.json({ ok: true }); }
    if (b.action === "seenAll") { const n = markAllKidSeen(b.kid || null); return NextResponse.json({ ok: true, cleared: n, ...kidsBoard() }); }
    if (b.action === "calendar") { return NextResponse.json(await kidToCalendar(b.id)); }
    if (b.action === "refresh") { const r = await syncCoparent(); return NextResponse.json({ ok: true, ...r, ...kidsBoard() }); }
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
