"use client";
import { useState, useEffect } from "react";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const STALE_MS = 12 * 3600e3;

function urgency(due) {
  if (!due) return { cls: "later", label: "" };
  const d = Math.ceil((new Date(due + "T12:00:00") - new Date()) / 86400e3);
  if (d < 0) return { cls: "overdue", label: "overdue" };
  if (d <= 3) return { cls: "soon", label: d === 0 ? "today" : d + "d" };
  if (d <= 7) return { cls: "week", label: d + "d" };
  return { cls: "later", label: new Date(due + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" }) };
}

export default function BillsCard() {
  const [bills, setBills] = useState(null);
  const [scanning, setScanning] = useState(false);

  async function scan() { setScanning(true); try { const j = await fetch("/api/bills", { method: "POST" }).then((r) => r.json()); if (j.ok) setBills(j.bills || []); } finally { setScanning(false); } }

  useEffect(() => {
    fetch("/api/bills").then((r) => r.json()).then((j) => {
      if (!j.ok) return setBills([]);
      setBills(j.bills || []);
      const stale = !j.scannedAt || (Date.now() - new Date(j.scannedAt).getTime()) > STALE_MS;
      if (stale) scan();
    }).catch(() => setBills([]));
  }, []);

  return (
    <div className="widget billscard">
      <div className="whead"><span className="wicon red"><M i="receipt_long" /></span><span className="wtitle">Bills Due</span><span className="grow" />
        <button className="iconbtn" title="Re-scan email" onClick={scan} disabled={scanning}><M i={scanning ? "hourglass_empty" : "refresh"} /></button>
      </div>
      <div className="wbody">
        {bills === null && <div className="wmuted">Scanning email…</div>}
        {bills && bills.length === 0 && <div className="wmuted">{scanning ? "Scanning email…" : "No bills found."}</div>}
        {bills && bills.map((b) => {
          const u = urgency(b.due_date);
          return (
            <div className={"bill bill-" + u.cls} key={b.id}>
              <span className="bill-dot" />
              <span className="bill-name">{b.name}</span>
              {b.category && <span className="bill-cat">{b.category}</span>}
              <span className="grow" />
              {b.amount && <span className="bill-amt">{b.amount}</span>}
              {u.label && <span className="bill-due">{u.label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
