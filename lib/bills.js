import { getDb } from "./db.js";
import { askJSON, FAST } from "./claude.js";
import { getMeta, setMeta } from "./meta.js";

const KW = /(payment due|amount due|invoice|statement|autopay|auto-pay|past due|balance due|minimum payment|due date|your bill|e-?bill)/i;

export function getBills() {
  const bills = getDb().prepare("SELECT id,name,due_date,amount,category FROM bills ORDER BY (due_date IS NULL OR due_date=''), due_date").all();
  return { bills, scannedAt: getMeta("bills_scanned_at") };
}

export async function scanBills() {
  const db = getDb();
  const rows = db.prepare("SELECT sender,subject,snippet FROM emails ORDER BY datetime(received_at) DESC LIMIT 250").all()
    .filter((e) => KW.test((e.subject || "") + " " + (e.snippet || "")));
  if (!rows.length) { db.prepare("DELETE FROM bills").run(); setMeta("bills_scanned_at", new Date().toISOString()); return getBills(); }
  const payload = rows.slice(0, 40).map((e) => ({ from: e.sender, subject: e.subject, preview: (e.snippet || "").slice(0, 200) }));
  let out;
  try {
    out = await askJSON({
      model: FAST,
      system: "You extract bills and payments due from Kurt's email. Be precise; ignore marketing.",
      prompt: `Today is ${new Date().toLocaleDateString("en-CA")}. From these emails, extract any real bills, invoices, or statements with a payment due. For each return {"name":"<biller>","dueDate":"YYYY-MM-DD or ''","amount":"<with $ or ''>","category":"utilities|subscriptions|insurance|credit|rent|other"}. Ignore promos/sales. At most 12. Return {"bills":[...]} only.\n\n${JSON.stringify(payload)}`,
      max_tokens: 1200,
    });
  } catch { return getBills(); }
  const items = Array.isArray(out.bills) ? out.bills : [];
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM bills").run();
    const ins = db.prepare("INSERT INTO bills (name,due_date,amount,category,source) VALUES (?,?,?,?,?)");
    for (const b of items) if (b && b.name) ins.run(String(b.name).slice(0, 60), /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || "") ? b.dueDate : "", (b.amount || "").slice(0, 20), b.category || "other", "email");
  });
  tx();
  setMeta("bills_scanned_at", new Date().toISOString());
  return getBills();
}
