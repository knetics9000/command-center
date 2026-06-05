import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chatTurn } from "@/lib/chat";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req) {
  try {
    const { contextId, projectName, message } = await req.json();
    if (!contextId || !message || !message.trim())
      return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    const db = getDb();

    const history = db
      .prepare("SELECT role,content FROM chat_messages WHERE context_id=? ORDER BY id DESC LIMIT 12")
      .all(contextId)
      .reverse();

    db.prepare("INSERT INTO chat_messages (context_type,context_id,role,content) VALUES ('project',?,'user',?)").run(contextId, message);

    const today = new Date().toISOString().slice(0, 10);
    const { reply, proposedEvents } = await chatTurn({ projectName: projectName || contextId, history, message, today });

    db.prepare("INSERT INTO chat_messages (context_type,context_id,role,content) VALUES ('project',?,'assistant',?)").run(contextId, reply);

    return NextResponse.json({ ok: true, reply, proposedEvents });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req) {
  const contextId = new URL(req.url).searchParams.get("contextId");
  if (!contextId) return NextResponse.json({ ok: false }, { status: 400 });
  const rows = getDb().prepare("SELECT role,content,created_at FROM chat_messages WHERE context_id=? ORDER BY id ASC LIMIT 40").all(contextId);
  return NextResponse.json({ ok: true, messages: rows });
}
