import { NextResponse } from "next/server";
import { generateCleanup, listCleanup, acceptSuggestion, dismissSuggestion } from "@/lib/cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ ok: true, suggestions: listCleanup() });
}

export async function POST(req) {
  try {
    const { action, id } = await req.json();
    if (action === "run") { const r = await generateCleanup(); return NextResponse.json({ ok: true, ...r, suggestions: listCleanup() }); }
    if (action === "accept") { const r = await acceptSuggestion(id); return NextResponse.json({ ok: true, ...r, suggestions: listCleanup() }); }
    if (action === "dismiss") { dismissSuggestion(id); return NextResponse.json({ ok: true, suggestions: listCleanup() }); }
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
