import { NextResponse } from "next/server";
import { requireCoachToken } from "@/lib/coachAuth";
import { listInfluences, upsertInfluence } from "@/lib/coachKnowledge";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!requireCoachToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ influences: listInfluences() });
}

export async function POST(req) {
  if (!requireCoachToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  const id = upsertInfluence({ id: body.id, name: body.name, why: body.why, styleNotes: body.styleNotes });
  return NextResponse.json({ id });
}
