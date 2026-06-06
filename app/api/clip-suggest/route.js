import { NextResponse } from "next/server";
import { askJSON, FAST } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { subject, snippet, sender } = await req.json();
    let title = (subject || "").slice(0, 80), tag = "";
    try {
      const out = await askJSON({
        model: FAST,
        system: "You turn an email into a concise, actionable to-do for Kurt.",
        prompt: `Email from ${sender || ""}: "${subject || ""}". Preview: "${(snippet || "").slice(0, 220)}".\nReturn {"title":"<short imperative task, <=8 words>","tag":"<one short tag like Bills, Kids Sports, Work, Personal, Home, or ''>"} only.`,
        max_tokens: 200,
      });
      if (out.title) title = String(out.title).slice(0, 100);
      if (out.tag) tag = String(out.tag).slice(0, 40);
    } catch {}
    return NextResponse.json({ ok: true, title, tag });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
