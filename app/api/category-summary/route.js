import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { askJSON, FAST } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const name = new URL(req.url).searchParams.get("name");
    if (!name) return NextResponse.json({ ok: false, error: "no name" }, { status: 400 });
    const db = getDb();
    const emails = db.prepare("SELECT sender,subject FROM emails WHERE handled=0 AND lower(category)=lower(?) ORDER BY datetime(received_at) DESC LIMIT 20").all(name);
    const tasks = db.prepare("SELECT text FROM tasks WHERE status='open' AND lower(tags) LIKE '%'||lower(?)||'%' LIMIT 30").all(name);
    if (!emails.length && !tasks.length) return NextResponse.json({ ok: true, summary: `Nothing active in ${name} right now.` });
    const out = await askJSON({
      model: FAST,
      system: "You summarize what's happening in one of Kurt's life categories. Be specific and brief.",
      prompt: `Category: "${name}". In 2-3 sentences, summarize what's happening here from the recent emails and open tasks, then add a one-line "Next:" action. Be concrete.\n\nEMAILS:\n${JSON.stringify(emails.map((e) => ({ from: e.sender, subject: e.subject })))}\n\nTASKS:\n${JSON.stringify(tasks.map((t) => t.text))}\n\nReturn {"summary":"<2-3 sentences + Next: ...>"} only.`,
      max_tokens: 400,
    });
    return NextResponse.json({ ok: true, summary: (out.summary || "").trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
