import { NextResponse } from "next/server";
import { getBody, getReplyMeta } from "@/lib/google";
import { askJSON, FAST } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// Suggest a calendar event from an email body (best guess; user edits + confirms).
export async function POST(req) {
  try {
    const { id, account } = await req.json();
    if (!id || !account) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    const [body, meta] = await Promise.all([getBody(account, id), getReplyMeta(account, id)]);
    const today = new Date().toISOString().slice(0, 10);

    const data = await askJSON({
      model: FAST,
      system: "You extract a single calendar event from an email. Today is " + today + " (America/New_York).",
      prompt:
        `Email subject: ${meta.subject}\n\n${body}\n\n` +
        `Return ONE JSON object: {"summary":"short event title","location":"address or '' ","start":"YYYY-MM-DDTHH:MM","durationMin":60}. ` +
        `Use the email's explicit date/time if present; otherwise pick a sensible near-future weekday at 10:00 and set durationMin 30. start is local wall-clock (no timezone). Return ONLY the object.`,
      max_tokens: 400,
    });

    return NextResponse.json({
      ok: true,
      summary: data.summary || meta.subject || "Event",
      location: data.location || "",
      start: data.start || "",
      durationMin: data.durationMin || 60,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
