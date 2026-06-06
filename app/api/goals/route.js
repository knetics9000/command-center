import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/meta";

export const dynamic = "force-dynamic";
const parse = (k) => { try { return JSON.parse(getMeta(k) || "[]"); } catch { return []; } };

export async function GET() {
  return NextResponse.json({ ok: true, week: parse("goals_week"), month: parse("goals_month") });
}

export async function POST(req) {
  try {
    const b = await req.json();
    if (Array.isArray(b.week)) setMeta("goals_week", JSON.stringify(b.week.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)));
    if (Array.isArray(b.month)) setMeta("goals_month", JSON.stringify(b.month.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
