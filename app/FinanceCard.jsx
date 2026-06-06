"use client";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const Row = ({ label, val }) => <div className="fin-row"><span className="fin-lbl">{label}</span><span className="fin-val">{val || "—"}</span></div>;

export default function FinanceCard() {
  const { toast } = useToast();
  const [f, setF] = useState(null);
  const [shown, setShown] = useState(false);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ netWorth: "", incomeMonth: "", incomeToday: "" });

  useEffect(() => { fetch("/api/finance").then((r) => r.json()).then((j) => { if (j.ok) setF(j); }).catch(() => setF({})); }, []);

  async function save() {
    setF((x) => ({ ...x, ...draft })); setEdit(false);
    await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }).catch(() => {});
    toast("Finance updated ✓");
  }

  return (
    <div className={"stat financard" + (shown ? " on" : "")}>
      {!shown ? (
        <div className="fin-hidden">
          <div className="fin-title"><M i="savings" /> Finance Pulse</div>
          <button className="clbtn" onClick={() => setShown(true)}>Reveal</button>
        </div>
      ) : edit ? (
        <div className="fin-edit">
          <div className="fin-title sm"><M i="savings" /> Edit Finance</div>
          <input className="fin-inp" placeholder="Net worth (e.g. $42,000)" value={draft.netWorth} onChange={(e) => setDraft((d) => ({ ...d, netWorth: e.target.value }))} />
          <input className="fin-inp" placeholder="Income this month" value={draft.incomeMonth} onChange={(e) => setDraft((d) => ({ ...d, incomeMonth: e.target.value }))} />
          <input className="fin-inp" placeholder="Income today" value={draft.incomeToday} onChange={(e) => setDraft((d) => ({ ...d, incomeToday: e.target.value }))} />
          <div className="fin-actrow"><button className="clbtn" onClick={save}>Save</button><button className="mbtn" onClick={() => setEdit(false)}>Cancel</button></div>
        </div>
      ) : (
        <div className="fin-shown">
          <div className="fin-head"><span className="fin-title sm"><M i="savings" /> Finance Pulse</span>
            <span className="fin-tools">
              <button className="iconbtn" title="Edit" onClick={() => { setDraft({ netWorth: f.netWorth || "", incomeMonth: f.incomeMonth || "", incomeToday: f.incomeToday || "" }); setEdit(true); }}><M i="edit" /></button>
              <button className="iconbtn" title="Hide" onClick={() => setShown(false)}><M i="visibility_off" /></button>
            </span>
          </div>
          <Row label="Net Worth" val={f && f.netWorth} />
          <Row label="Income (month)" val={f && f.incomeMonth} />
          <Row label="Income (today)" val={f && f.incomeToday} />
        </div>
      )}
    </div>
  );
}
