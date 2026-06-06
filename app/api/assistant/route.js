import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { assistantTurn } from "@/lib/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const CTX = "__assistant__";

export async function GET() {
  const rows = getDb().prepare("SELECT role,content FROM chat_messages WHERE context_id=? ORDER BY id ASC LIMIT 60").all(CTX);
  return NextResponse.json({ ok: true, messages: rows });
}

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message || !message.trim()) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    const db = getDb();
    const history = db.prepare("SELECT role,content FROM chat_messages WHERE context_id=? ORDER BY id DESC LIMIT 12").all(CTX).reverse();
    db.prepare("INSERT INTO chat_messages (context_type,context_id,role,content) VALUES ('assistant',?,'user',?)").run(CTX, message);
    const today = new Date().toISOString().slice(0, 10);
    const { reply } = await assistantTurn({ history, message, today });
    db.prepare("INSERT INTO chat_messages (context_type,context_id,role,content) VALUES ('assistant',?,'assistant',?)").run(CTX, reply);
    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  getDb().prepare("DELETE FROM chat_messages WHERE context_id=?").run(CTX);
  return NextResponse.json({ ok: true });
}
