import { NextResponse } from "next/server";
import { addDismissal, removeDismissal, dismissalKeys } from "@/lib/dismiss";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, keys: dismissalKeys() });
}

export async function POST(req) {
  try {
    const b = await req.json();
    if (b.undo) removeDismissal(b.key);
    else addDismissal(b.key, b.until || null);   // until set = snooze
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
