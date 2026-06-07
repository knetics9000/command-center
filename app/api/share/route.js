import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logShare, listShared, deleteShared, analyzeShare, getOne } from "@/lib/share";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ ok: true, items: listShared() });
}

export async function POST(req) {
  try {
    let body = {};
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) body = await req.json();
    else { const f = await req.formData(); body = { title: f.get("title"), text: f.get("text"), url: f.get("url") }; }

    if (body.action === "delete") { deleteShared(body.id); return NextResponse.json({ ok: true }); }
    if (body.action === "reanalyze") { await analyzeShare(body.id); return NextResponse.json({ ok: true, item: getOne(body.id) }); }
    if (body.action === "addproject") {
      const db = getDb();
      const r = getOne(body.id);
      if (r) { const set = Array.from(new Set([...(r.projects || []), body.tag].filter(Boolean))); db.prepare("UPDATE shared_items SET projects=? WHERE id=?").run(JSON.stringify(set), body.id); }
      return NextResponse.json({ ok: true, item: getOne(body.id) });
    }

    const item = await logShare({ title: body.title, text: body.text, url: body.url });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
