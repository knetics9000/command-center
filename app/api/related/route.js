import { NextResponse } from "next/server";
import { relatedFor, aiContext } from "@/lib/relate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { title = "", keywords = [], projectTag = "", excludeEmailId = "", withAI = false } = await req.json();
    const rel = relatedFor({ title, keywords, projectTag, excludeEmailId });
    const ai = withAI ? await aiContext(title || projectTag, rel) : null;
    return NextResponse.json({ ok: true, ...rel, ai });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
