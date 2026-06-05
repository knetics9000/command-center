import { NextResponse } from "next/server";
import { getBody, getReplyMeta, createReplyDraft } from "@/lib/google";
import { askSmart } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VOICE =
  "You are drafting an email reply for Kurt. Write in his voice: warm, direct, concise, professional but human. " +
  "No corporate fluff. Return ONLY the reply body text (no subject line, no 'Dear', no signature block beyond a simple 'Thanks,\\nKurt' if a sign-off fits).";

export async function POST(req) {
  try {
    const { action, id, account, text, instructions } = await req.json();
    if (!id || !account) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

    if (action === "generate") {
      const [body, meta] = await Promise.all([getBody(account, id), getReplyMeta(account, id)]);
      const prompt =
        `Email from ${meta.from}\nSubject: ${meta.subject}\n\n--- message ---\n${body}\n--- end ---\n\n` +
        (instructions ? `Kurt's intent for the reply: ${instructions}\n\n` : "") +
        "Write Kurt's reply.";
      const draft = await askSmart(prompt, VOICE);
      return NextResponse.json({ ok: true, text: draft.trim(), to: meta.from, subject: meta.subject });
    }

    if (action === "save") {
      if (!text || !text.trim()) return NextResponse.json({ ok: false, error: "empty draft" }, { status: 400 });
      const meta = await getReplyMeta(account, id);
      const d = await createReplyDraft(account, meta, text.trim());
      return NextResponse.json({ ok: true, draftId: d.id });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
