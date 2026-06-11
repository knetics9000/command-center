import { NextResponse } from "next/server";
import { requireCoachToken } from "@/lib/coachAuth";
import { retrieveRelevant, generateDeep, sourceLabel, logInteraction } from "@/lib/coachExpand";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  if (!requireCoachToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.situation) return NextResponse.json({ ok: false, error: "situation required" }, { status: 400 });
  const items = await retrieveRelevant(body.situation).catch(() => []);
  try {
    const gen = await generateDeep({
      situation: body.situation,
      shortAnswer: body.shortAnswer || {},
      personaName: body.persona?.name,
      personaVoice: body.persona?.voice,
      profile: body.profile || "",
      items,
    });
    try {
      logInteraction({
        conversationId: body.conversationId,
        situation: body.situation,
        shortAnswer: body.shortAnswer,
        retrievedIds: items.map((m) => m.id),
        sourceIds: gen.sourceIds,
        deep: gen.deep,
      });
    } catch {}
    const byId = new Map(items.map((m) => [m.id, m]));
    return NextResponse.json({
      deep: gen.deep,
      sources: gen.sourceIds.map((id) => ({ id, label: sourceLabel(byId.get(id)), type: byId.get(id).type })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "expand failed" }, { status: 500 });
  }
}
