import { NextResponse } from "next/server";
import { getHealth, refreshHealth, healthConnected, debugHealth } from "@/lib/health";
export const dynamic = "force-dynamic";
export const maxDuration = 40;
export async function GET(req) {
  if (new URL(req.url).searchParams.get("debug")) return NextResponse.json({ ok: true, ...(await debugHealth()) });
  return NextResponse.json({ ok: true, ...(await getHealth()) });
}
export async function POST() {
  if (!healthConnected()) return NextResponse.json({ ok: true, connected: false });
  return NextResponse.json({ ok: true, ...(await refreshHealth()) });
}
