"use client";
import { useState, useEffect } from "react";

const ago = (ts) => { if (!ts) return "never run"; const d = new Date(ts.replace(" ", "T") + "Z"); const s = (Date.now() - d) / 1000; if (isNaN(s)) return ""; if (s < 3600) return Math.round(s / 60) + "m ago"; if (s < 86400) return Math.round(s / 3600) + "h ago"; return Math.round(s / 86400) + "d ago"; };

export default function StandingRules({ contextId }) {
  const [rules, setRules] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(null);

  async function load() {
    const j = await fetch("/api/rules?contextId=" + encodeURIComponent(contextId)).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setRules(j.rules || []);
  }
  useEffect(() => { load(); }, [contextId]);

  async function post(body) {
    const r = await fetch("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json().catch(() => ({}));
  }
  async function add() {
    const t = text.trim(); if (!t) return;
    setText(""); await post({ action: "create", contextId, instruction: t }); load();
  }
  async function run(id) {
    setBusy(id);
    try { const j = await post({ action: "run", id }); if (j.ok) alert(`Rule ran: ${j.created?.length || 0} event(s) added.\n${j.summary || ""}`); else alert("Failed: " + (j.error || "")); load(); }
    finally { setBusy(null); }
  }

  return (
    <div className="rules">
      <div className="rlbl">⏱ Standing rules <span className="rsub">run automatically every 15 min on new mail</span></div>
      {rules.map((r) => (
        <div className={"rule" + (r.enabled ? "" : " off")} key={r.id}>
          <span className="rtext">{r.instruction}</span>
          <span className="rmeta">{ago(r.last_run)}</span>
          <button className="rmini" disabled={busy === r.id} onClick={() => run(r.id)}>{busy === r.id ? "…" : "Run"}</button>
          <button className="rmini" onClick={async () => { await post({ action: "toggle", id: r.id }); load(); }}>{r.enabled ? "Pause" : "Resume"}</button>
          <button className="rmini del" onClick={async () => { await post({ action: "delete", id: r.id }); load(); }}>✕</button>
        </div>
      ))}
      <div className="addrow">
        <input className="addinp" placeholder="e.g. Add any new i9 Sports game times to my calendar" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="addbtn" onClick={add}>＋</button>
      </div>
    </div>
  );
}
