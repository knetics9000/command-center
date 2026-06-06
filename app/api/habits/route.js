import { NextResponse } from "next/server";
import { getTemplate, getEntry, saveEntry, todayLocal } from "@/lib/habits";

export const dynamic = "force-dynamic";

export async function GET() {
  const date = todayLocal();
  return NextResponse.json({ ok: true, date, template: getTemplate(), data: getEntry(date) });
}

export async function POST(req) {
  try {
    const { data } = await req.json();
    saveEntry(todayLocal(), data || {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
