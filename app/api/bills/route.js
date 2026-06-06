import { NextResponse } from "next/server";
import { getBills, scanBills } from "@/lib/bills";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ ok: true, ...getBills() });
}

export async function POST() {
  try {
    const r = await scanBills();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
