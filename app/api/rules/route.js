import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runRule } from "@/lib/rules";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req) {
  const contextId = new URL(req.url).searchParams.get("contextId");
  const db = getDb();
  const rows = contextId
    ? db.prepare("SELECT * FROM standing_rules WHERE context_id=? ORDER BY id DESC").all(contextId)
    : db.prepare("SELECT * FROM standing_rules ORDER BY id DESC").all();
  return NextResponse.json({ ok: true, rules: rows });
}

export async function POST(req) {
  try {
    const b = await req.json();
    const db = getDb();

    if (b.action === "create") {
      if (!b.instruction || !b.instruction.trim()) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
      const r = db.prepare("INSERT INTO standing_rules (context_id,instruction,enabled) VALUES (?,?,1)").run(b.contextId || null, b.instruction.trim());
      return NextResponse.json({ ok: true, id: Number(r.lastInsertRowid) });
    }
    if (b.action === "toggle") {
      db.prepare("UPDATE standing_rules SET enabled=CASE enabled WHEN 1 THEN 0 ELSE 1 END WHERE id=?").run(b.id);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "delete") {
      db.prepare("DELETE FROM standing_rules WHERE id=?").run(b.id);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "run") {
      const rule = db.prepare("SELECT * FROM standing_rules WHERE id=?").get(b.id);
      if (!rule) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
      const res = await runRule(rule);
      return NextResponse.json({ ok: true, ...res });
    }
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
