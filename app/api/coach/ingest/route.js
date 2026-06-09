import { NextResponse } from "next/server";
import { requireCoachToken } from "@/lib/coachAuth";
import { getDb } from "@/lib/db";
import { findOrCreateInfluence, insertMaterial, analyzeGuruMaterial } from "@/lib/coachKnowledge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  if (!requireCoachToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { url, text, title, influenceId, influenceName, type } = body;
  if (!url && !text) return NextResponse.json({ ok: false, error: "url or text required" }, { status: 400 });
  const itemType = type === "personal" ? "personal" : "material";
  const db = getDb();
  const infId = itemType === "personal" ? null : findOrCreateInfluence(db, { id: influenceId, name: influenceName });
  const id = insertMaterial({ url, text, title, influenceId: infId, source: "app", type: itemType });
  // fire-and-forget analysis; don't block the response
  analyzeGuruMaterial(id).catch(() => {});
  return NextResponse.json({ id });
}
