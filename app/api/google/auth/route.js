import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const account = new URL(req.url).searchParams.get("account");
  if (account !== "personal" && account !== "work") {
    return NextResponse.json({ error: "account must be 'personal' or 'work'" }, { status: 400 });
  }
  return NextResponse.redirect(getAuthUrl(account));
}
