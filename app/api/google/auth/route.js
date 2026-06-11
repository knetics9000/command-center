import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const account = new URL(req.url).searchParams.get("account");
  if (!["personal", "work", "coparent"].includes(account)) {
    return NextResponse.json({ error: "unknown account" }, { status: 400 });
  }
  return NextResponse.redirect(getAuthUrl(account));
}
