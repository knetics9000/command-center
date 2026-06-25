import { NextResponse } from "next/server";
import { listThoughts, summaryLines } from "@/lib/sync-thoughts";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = listThoughts(50).map((t) => ({
    id: t.id,
    created_at: t.created_at,
    source: t.source,
    bullets: summaryLines(t.summary),
    prose: t.retextualized_text || "",
    raw: t.raw_text || "",
  }));
  return NextResponse.json({ ok: true, items });
}
