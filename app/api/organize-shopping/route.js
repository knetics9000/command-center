import { NextResponse } from "next/server";
import { askJSON, FAST } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { items } = await req.json();
    const list = (items || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 120);
    if (!list.length) return NextResponse.json({ ok: true, sections: [] });
    const out = await askJSON({
      model: FAST,
      system: "You organize a grocery list by store section for an efficient shopping path.",
      prompt: `Group these grocery items by store section (Produce, Bakery, Deli, Meat & Seafood, Dairy, Frozen, Pantry, Beverages, Snacks, Household, Personal Care, Other). Keep EVERY item exactly; don't invent or drop items. Order sections by a sensible in-store path. Return {"sections":[{"name":"<section>","items":["<item>",...]}]} only.\n\n${JSON.stringify(list)}`,
      max_tokens: 1500,
    });
    const sections = Array.isArray(out.sections) ? out.sections.filter((s) => s && s.name && Array.isArray(s.items) && s.items.length) : [];
    return NextResponse.json({ ok: true, sections });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
