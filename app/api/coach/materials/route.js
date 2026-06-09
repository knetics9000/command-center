import { NextResponse } from "next/server";
import { requireCoachToken } from "@/lib/coachAuth";
import { listMaterials } from "@/lib/coachKnowledge";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!requireCoachToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const influenceId = searchParams.get("influenceId") || undefined;
  return NextResponse.json({ materials: listMaterials({ q, influenceId: influenceId ? Number(influenceId) : undefined }) });
}
