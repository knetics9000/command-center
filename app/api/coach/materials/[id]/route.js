import { NextResponse } from "next/server";
import { requireCoachToken } from "@/lib/coachAuth";
import { deleteMaterial } from "@/lib/coachKnowledge";

export const dynamic = "force-dynamic";

export async function DELETE(req, { params }) {
  if (!requireCoachToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  deleteMaterial(Number(params.id));
  return NextResponse.json({ ok: true });
}
