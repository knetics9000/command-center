"use client";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

export default function GoalsCard() {
  const { toast } = useToast();
  const [g, setG] = useState({ week: [], month: [] });
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ week: "", month: "" });

  useEffect(() => { fetch("/api/goals").then((r) => r.json()).then((j) => { if (j.ok) setG({ week: j.week || [], month: j.month || [] }); }).catch(() => {}); }, []);

  function openEdit() { setDraft({ week: (g.week || []).join("\n"), month: (g.month || []).join("\n") }); setEdit(true); }
  async function save() {
    const week = draft.week.split("\n").map((x) => x.trim()).filter(Boolean);
    const month = draft.month.split("\n").map((x) => x.trim()).filter(Boolean);
    setG({ week, month }); setEdit(false);
    await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week, month }) }).catch(() => {});
    toast("Goals saved ✓");
  }

  return (
    <div className="widget goalscard">
      <div className="whead"><span className="wicon"><M i="flag" /></span><span className="wtitle">Goals</span><span className="grow" />
        <button className="iconbtn" title={edit ? "Cancel" : "Edit"} onClick={() => (edit ? setEdit(false) : openEdit())}><M i={edit ? "close" : "edit"} /></button>
      </div>
      {!edit ? (
        <div className="wbody">
          <div className="goal-sec">This Week</div>
          {(g.week || []).length === 0 ? <div className="wmuted">— none set —</div> : g.week.slice(0, 5).map((x, i) => <div className="goal-li" key={i}>• {x}</div>)}
          <div className="goal-sec mt">This Month</div>
          {(g.month || []).length === 0 ? <div className="wmuted">— none set —</div> : g.month.slice(0, 5).map((x, i) => <div className="goal-li" key={i}>• {x}</div>)}
        </div>
      ) : (
        <div className="wbody">
          <div className="goal-sec">This Week <span className="goal-hint">(one per line)</span></div>
          <textarea className="goal-ta" rows={3} value={draft.week} onChange={(e) => setDraft((d) => ({ ...d, week: e.target.value }))} />
          <div className="goal-sec mt">This Month</div>
          <textarea className="goal-ta" rows={3} value={draft.month} onChange={(e) => setDraft((d) => ({ ...d, month: e.target.value }))} />
          <button className="clbtn" style={{ marginTop: 8 }} onClick={save}>Save</button>
        </div>
      )}
    </div>
  );
}
