// Token-authed ingest for the Android NotificationListener app.
// This path is exempted from the site's basic-auth wall (see Caddyfile) so the
// device can reach it directly — the bearer token IS the authentication here.
import { NextResponse } from "next/server";
import { ingestNotification, ingestBatch } from "@/lib/notify";

export const dynamic = "force-dynamic";

function authed(req) {
  const want = process.env.NOTIFY_TOKEN;
  if (!want) return false; // fail closed if no token is configured
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return got && got === want;
}

export async function POST(req) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const b = await req.json();
    if (Array.isArray(b)) return NextResponse.json(ingestBatch(b));
    if (Array.isArray(b.items)) return NextResponse.json(ingestBatch(b.items));
    return NextResponse.json(ingestNotification(b));
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}

// Lets the device verify connectivity + token without sending data.
export async function GET(req) {
  return NextResponse.json({ ok: authed(req) });
}
