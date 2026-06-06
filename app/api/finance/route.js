import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/meta";

export const dynamic = "force-dynamic";

export async function GET() {
  let f = {}; try { f = JSON.parse(getMeta("finance") || "{}"); } catch {}
  return NextResponse.json({ ok: true, netWorth: f.netWorth || "", incomeMonth: f.incomeMonth || "", incomeToday: f.incomeToday || "" });
}

export async function POST(req) {
  try {
    const { netWorth, incomeMonth, incomeToday } = await req.json();
    setMeta("finance", JSON.stringify({ netWorth: netWorth || "", incomeMonth: incomeMonth || "", incomeToday: incomeToday || "" }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
