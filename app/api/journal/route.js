import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { askJSON, FAST } from "@/lib/claude";
import { todayLocal } from "@/lib/habits";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = getDb().prepare("SELECT date,raw,summary FROM journal ORDER BY date DESC LIMIT 60").all();
  return NextResponse.json({ ok: true, today: todayLocal(), entries: rows });
}

export async function POST(req) {
  try {
    const { raw } = await req.json();
    const date = todayLocal();
    const text = (raw || "").trim();
    let summary = "";
    if (text) {
      try {
        const out = await askJSON({
          model: FAST,
          system: "You summarize Kurt's daily journal entry warmly and concisely.",
          prompt: `Summarize this journal entry in exactly 3 short sentences — one highlight, one struggle, one key insight or takeaway. Write in second person ("You ...").\n\nENTRY:\n${text}\n\nReturn {"summary":"<3 sentences>"}.`,
          max_tokens: 400,
        });
        summary = (out.summary || "").trim();
      } catch { summary = ""; }
    }
    getDb().prepare("INSERT INTO journal (date,raw,summary,updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(date) DO UPDATE SET raw=excluded.raw, summary=excluded.summary, updated_at=datetime('now')")
      .run(date, text, summary);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
