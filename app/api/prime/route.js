import { NextResponse } from "next/server";
import { listPrimeTasks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, tasks: listPrimeTasks() });
}
