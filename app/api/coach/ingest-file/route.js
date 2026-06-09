import { NextResponse } from "next/server";
import { requireCoachToken } from "@/lib/coachAuth";
import { detectFormat, parseChatGptExport, parseClaudeExport, parsePlainText, importConversations } from "@/lib/coachImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req) {
  if (!requireCoachToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let file;
  try { file = (await req.formData()).get("file"); } catch { file = null; }
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "file too large (max 25 MB)" }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const format = detectFormat(file.name || "", buffer);
    const items =
      format === "chatgpt" ? parseChatGptExport(buffer) :
      format === "claude" ? parseClaudeExport(buffer) :
      parsePlainText(buffer, file.name);
    if (!items.length) return NextResponse.json({ ok: false, error: "couldn't read that file" }, { status: 400 });
    const { count } = importConversations(items, { cap: 100 });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ ok: false, error: "couldn't read that file" }, { status: 400 });
  }
}
