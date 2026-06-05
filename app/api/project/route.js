import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Create a project (e.g. from a briefing cluster). Establishes a "<Name> Project"
// tag; tasks added to it later merge in by tag. Optionally linked to a cluster.
export async function POST(req) {
  try {
    const { action, name, clusterId } = await req.json();
    if (action !== "create" || !name || !name.trim())
      return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    const clean = name.trim();
    const tag = /project/i.test(clean) ? clean : clean + " Project";
    const db = getDb();
    const exists = db.prepare("SELECT id FROM projects WHERE lower(tag)=lower(?)").get(tag);
    if (exists) return NextResponse.json({ ok: true, tag, already: true });
    db.prepare("INSERT INTO projects (name,tag,cluster_id,source,status) VALUES (?,?,?,'suggested','active')")
      .run(clean.replace(/\s*project\s*$/i, "").trim() || clean, tag, clusterId || null);
    return NextResponse.json({ ok: true, tag });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
