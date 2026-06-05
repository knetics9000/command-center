import { NextResponse } from "next/server";
import { generateBriefing } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { primary } = await req.json().catch(() => ({}));
    const data = await generateBriefing({ primary: !!primary });
    return NextResponse.json({ ok: true, briefing: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
