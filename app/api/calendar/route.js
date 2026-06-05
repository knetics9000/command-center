import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createEvent } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Irreversible: actually creates events. Only called on explicit user confirmation.
// Auto-created events land on the PERSONAL calendar (per spec).
export async function POST(req) {
  try {
    const { action, events, contextId } = await req.json();
    if (action !== "create" || !Array.isArray(events) || !events.length)
      return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    const db = getDb();
    const created = [];
    for (const e of events) {
      const ev = await createEvent("personal", { summary: e.summary, location: e.location || "", description: e.description || "", start: e.start, end: e.end });
      db.prepare(
        `INSERT INTO calendar_events (gcal_event_id,calendar_account,title,location,start,end,source,project_id)
         VALUES (?,?,?,?,?,?, 'chat', NULL)`
      ).run(ev.id, "personal", e.summary, e.location || "", e.start, e.end);
      created.push({ id: ev.id, summary: e.summary, htmlLink: ev.htmlLink });
    }
    if (contextId)
      db.prepare("INSERT INTO chat_messages (context_type,context_id,role,content) VALUES ('project',?,'assistant',?)")
        .run(contextId, `✓ Added ${created.length} event(s) to your calendar.`);
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
