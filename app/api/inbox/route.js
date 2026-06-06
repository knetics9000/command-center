import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveMsg, doneMsg, spamMsg, restoreMsg } from "@/lib/google";
import { recordFeedback } from "@/lib/priority";

export const dynamic = "force-dynamic";

const OPS = {
  archive: { fn: archiveMsg, state: "archived", handled: 1 },
  done: { fn: doneMsg, state: "done", handled: 1 },
  spam: { fn: spamMsg, state: "spam", handled: 1 },
  restore: { fn: restoreMsg, state: null, handled: 0 },
};

export async function POST(req) {
  try {
    const { action, id, account, until, projectTag, etags } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

    // Assign an email to a project and/or set custom tags (Command-Center-only, survives sync).
    if (action === "link") {
      const db = getDb();
      const sets = [], params = [];
      if (projectTag !== undefined) { sets.push("project_tag=?"); params.push(projectTag || null); }
      if (etags !== undefined) { sets.push("etags=?"); params.push(etags || null); }
      if (!sets.length) return NextResponse.json({ ok: false, error: "nothing to set" }, { status: 400 });
      params.push(id);
      db.prepare(`UPDATE emails SET ${sets.join(", ")}, updated_at=datetime('now') WHERE id=?`).run(...params);
      return NextResponse.json({ ok: true });
    }

    // Priority decisions (learning loop). notpriority_archive also archives in Gmail.
    if (action === "priority" || action === "notpriority" || action === "notpriority_archive") {
      const db = getDb();
      const decision = action === "priority" ? 1 : 0;
      const e = db.prepare("SELECT sender_addr, account FROM emails WHERE id=?").get(id);
      db.prepare("UPDATE emails SET priority=?, updated_at=datetime('now') WHERE id=?").run(decision, id);
      if (e) recordFeedback(e.sender_addr, decision);
      if (action === "notpriority_archive") {
        const acc = account || (e && e.account);
        await archiveMsg(acc, id);
        db.prepare("UPDATE emails SET handled=1, handled_state='archived', snooze_until=NULL WHERE id=?").run(id);
      }
      return NextResponse.json({ ok: true });
    }

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
