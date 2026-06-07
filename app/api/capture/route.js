import { NextResponse } from "next/server";
import { addCapture, processCapture, listCaptures, markDone, deleteCapture, getOne } from "@/lib/capture";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({ ok: true, captures: listCaptures() });
}

export async function POST(req) {
  try {
    const b = await req.json();
    if (b.action === "done") { markDone(b.id, b.done ?? 1); return NextResponse.json({ ok: true }); }
    if (b.action === "delete") { deleteCapture(b.id); return NextResponse.json({ ok: true }); }
    if (b.action === "reprocess") { return NextResponse.json({ ok: true, capture: await processCapture(b.id) }); }
    // default: capture a brain-dump and process it instantly
    const id = addCapture(b.raw_text, b.source);
    if (!id) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    let capture = getOne(id);
    try { capture = (await processCapture(id)) || capture; } catch {}
    return NextResponse.json({ ok: true, capture });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
