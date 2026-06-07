import { NextResponse } from "next/server";
import { healthAuthUrl } from "@/lib/health";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.redirect(healthAuthUrl());
}
