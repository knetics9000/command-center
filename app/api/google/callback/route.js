import { NextResponse } from "next/server";
import { handleCallback } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const account = u.searchParams.get("state");
  if (!code || (account !== "personal" && account !== "work")) {
    return NextResponse.redirect(new URL("/connect?error=missing_code_or_state", u.origin));
  }
  try {
    await handleCallback(code, account);
    return NextResponse.redirect(new URL("/connect?connected=" + account, u.origin));
  } catch (e) {
    return NextResponse.redirect(new URL("/connect?error=" + encodeURIComponent(e.message || "callback_failed"), u.origin));
  }
}
