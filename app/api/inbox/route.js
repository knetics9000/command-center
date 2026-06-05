import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveMsg, doneMsg, spamMsg, restoreMsg } from "@/lib/google";

export const dynamic = "force-dynamic";

const OPS = {
  archive: { fn: archiveMsg, state: "archived", handled: 1 },
  done: { fn: doneMsg, state: "done", handled: 1 },
  spam: { fn: spamMsg, state: "spam", handled: 1 },
  restore: { fn: restoreMsg, state: null, handled: 0 },
};

export async function POST(req) {
  try {
    const { action, id, account } = await req.json();
    const op = OPS[action];
    if (!op || !id || !account) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    await op.fn(account, id); // real Gmail label change (reversible)
    getDb().prepare("UPDATE emails SET handled=?, handled_state=?, updated_at=datetime('now') WHERE id=?")
      .run(op.handled, op.state, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
