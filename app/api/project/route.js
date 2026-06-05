import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(req) {
  const tag = new URL(req.url).searchParams.get("tag");
  if (!tag) return NextResponse.json({ ok: false }, { status: 400 });
  const row = getDb().prepare("SELECT notes FROM projects WHERE lower(tag)=lower(?)").get(tag);
  return NextResponse.json({ ok: true, notes: (row && row.notes) || "" });
}

// Create a project (e.g. from a briefing cluster). Establishes a "<Name> Project"
// tag; tasks added to it later merge in by tag. Optionally linked to a cluster.
export async function POST(req) {
  try {
    const { action, name, clusterId, tag, notes } = await req.json();
    const db = getDb();

    // Save context notes for a project tag (upsert; auto-creates a row for auto-detected tags).
    if (action === "note") {
      if (!tag) return NextResponse.json({ ok: false, error: "no tag" }, { status: 400 });
      const exists = db.prepare("SELECT id FROM projects WHERE lower(tag)=lower(?)").get(tag);
      if (exists) db.prepare("UPDATE projects SET notes=? WHERE id=?").run(notes || null, exists.id);
      else db.prepare("INSERT INTO projects (name,tag,source,status,notes) VALUES (?,?,'auto','active',?)")
        .run(tag.replace(/\s*project\s*$/i, "").trim() || tag, tag, notes || null);
      return NextResponse.json({ ok: true });
    }

    if (action !== "create" || !name || !name.trim())
      return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    const clean = name.trim();
    const ctag = /project/i.test(clean) ? clean : clean + " Project";
    const exists = db.prepare("SELECT id FROM projects WHERE lower(tag)=lower(?)").get(ctag);
    if (exists) return NextResponse.json({ ok: true, tag: ctag, already: true });
    db.prepare("INSERT INTO projects (name,tag,cluster_id,source,status) VALUES (?,?,?,'suggested','active')")
      .run(clean.replace(/\s*project\s*$/i, "").trim() || clean, ctag, clusterId || null);
    return NextResponse.json({ ok: true, tag: ctag });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
