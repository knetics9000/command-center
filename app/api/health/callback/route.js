import { NextResponse } from "next/server";
import { saveHealthToken } from "@/lib/health";
export const dynamic = "force-dynamic";
export async function GET(req) {
  const code = new URL(req.url).searchParams.get("code");
  const base = process.env.APP_BASE_URL || new URL(req.url).origin;
  if (code) { try { await saveHealthToken(code); } catch (e) { return NextResponse.redirect(base + "/?health=error"); } }
  return NextResponse.redirect(base + "/?health=connected");
}
