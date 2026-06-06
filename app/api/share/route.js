import { NextResponse } from "next/server";
import { logShare, listShared, deleteShared } from "@/lib/share";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

    const item = await logShare({ title: body.title, text: body.text, url: body.url });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
