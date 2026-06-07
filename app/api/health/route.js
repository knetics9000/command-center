import { NextResponse } from "next/server";
import { getHealth, refreshHealth, healthConnected } from "@/lib/health";
export const dynamic = "force-dynamic";
export const maxDuration = 40;
export async function GET() { return NextResponse.json({ ok: true, ...(await getHealth()) }); }
export async function POST() {
  if (!healthConnected()) return NextResponse.json({ ok: true, connected: false });
  return NextResponse.json({ ok: true, ...(await refreshHealth()) });
}
