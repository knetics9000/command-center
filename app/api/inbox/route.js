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
    const { action, id, account, until } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

    // Snooze is Command-Center-only: hide from the board until `until`, no Gmail change.
    if (action === "snooze") {
      if (!until) return NextResponse.json({ ok: false, error: "no time" }, { status: 400 });
      getDb().prepare("UPDATE emails SET handled=1, handled_state='snoozed', snooze_until=?, updated_at=datetime('now') WHERE id=?").run(until, id);
      return NextResponse.json({ ok: true });
    }

    const op = OPS[action];
    if (!op || !account) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    await op.fn(account, id); // real Gmail label change (reversible)
    getDb().prepare("UPDATE emails SET handled=?, handled_state=?, snooze_until=NULL, updated_at=datetime('now') WHERE id=?")
      .run(op.handled, op.state, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
