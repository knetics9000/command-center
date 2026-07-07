import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { addTask, completeTask, retagTask, upsertOffload } from "@/lib/offload";

export const dynamic = "force-dynamic";

// Real Offload ids push back to the sheet; locally-added "u_" ids only exist here until a real sync.
const isReal = (id) => id && !id.startsWith("u_");
function localId(text) {
  let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return "u_local_" + Math.abs(h) + "_" + (text.length);
}

export async function POST(req) {
  try {
    const b = await req.json();
    const db = getDb();

    if (b.action === "check") {
      if (isReal(b.id)) await completeTask(b.id); // push to Offload only for real ids
      db.prepare("UPDATE tasks SET status='completed', updated_at=datetime('now') WHERE id=?").run(b.id);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "add") {
      const text = (b.text || "").trim();
      const tags = (b.tag || b.tags || "").trim();
      if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
      await addTask(text, tags); // blank id -> Offload appends; phone stamps real id on next sync
      const id = localId(text + tags);
      db.prepare(
        `INSERT OR REPLACE INTO tasks (id,text,tags,type,status,source,created_at,synced,updated_at)
         VALUES (?,?,?,'task','open','offload',datetime('now'),0,datetime('now'))`
      ).run(id, text, tags);
      return NextResponse.json({ ok: true, id, syncing: true });
    }

    if (b.action === "edit") {
      const text = (b.text || "").trim();
      if (!text || !b.id) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
      if (isReal(b.id)) await upsertOffload([{ id: b.id, text }]); // push the edit back to Offload
      db.prepare("UPDATE tasks SET text=?, updated_at=datetime('now') WHERE id=?").run(text, b.id);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "setdue") {
      const due = (b.due || "").trim() || null; // "YYYY-MM-DD" or clear
      db.prepare("UPDATE tasks SET due=?, updated_at=datetime('now') WHERE id=?").run(due, b.id);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "prime") {   // local-only pin to the Prime list
      db.prepare("UPDATE tasks SET prime=?, updated_at=datetime('now') WHERE id=?").run(b.prime ? 1 : 0, b.id);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "retag") {
      const tags = (b.tags || "").trim();
      if (isReal(b.id)) await retagTask(b.id, tags);
      db.prepare("UPDATE tasks SET tags=?, updated_at=datetime('now') WHERE id=?").run(tags, b.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
