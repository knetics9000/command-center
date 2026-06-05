import { NextResponse } from "next/server";
import { getBody } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const u = new URL(req.url);
    const account = u.searchParams.get("account");
    const id = u.searchParams.get("id");
    if (!account || !id) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    const body = await getBody(account, id);
    return NextResponse.json({ ok: true, body });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
