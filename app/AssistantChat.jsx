"use client";
import { useState, useEffect, useRef } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const SUGGESTIONS = [
  "What needs my attention today?",
  "How many priority emails do I have?",
  "What's due or expiring this month?",
  "Summarize the CarHustlr emails",
  "What are my Kids Sports items?",
];

export default function AssistantChat() {
  const { toast } = useToast();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proposed, setProposed] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    fetch("/api/assistant").then((r) => r.json()).then((j) => { if (j.ok) setMsgs(j.messages || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);

  async function ask(q) {
    const m = (q || text).trim(); if (!m || busy) return;
    setText(""); setProposed([]); setMsgs((x) => [...x, { role: "user", content: m }]); setBusy(true);
    try {
      const j = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: m }) }).then((r) => r.json());
      setMsgs((x) => [...x, { role: "assistant", content: j.ok ? j.reply : "⚠ " + (j.error || "failed") }]);
      if (j.ok && j.proposedActions && j.proposedActions.length) setProposed(j.proposedActions);
    } catch (e) { setMsgs((x) => [...x, { role: "assistant", content: "⚠ " + e.message }]); }
    finally { setBusy(false); }
  }
  async function confirm() {
    setConfirming(true);
    try {
      const j = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", actions: proposed }) }).then((r) => r.json());
      if (j.ok) { const ok = (j.results || []).filter((r) => r.ok).length; setMsgs((x) => [...x, { role: "assistant", content: `✓ Applied ${ok} of ${(j.results || []).length} action(s).` }]); setProposed([]); toast("Actions applied ✓"); }
      else toast({ message: j.error || "Failed", tone: "error" });
    } finally { setConfirming(false); }
  }
  const actIcon = (t) => ({ mark_priority: "star", mark_not_priority: "star_border", archive: "archive", add_event: "event", add_task: "add_task" }[t] || "bolt");
  async function clear() {
    await fetch("/api/assistant", { method: "DELETE" }).catch(() => {});
    setMsgs([]); toast("Conversation cleared");
  }

  return (
    <div className="card asscard">
      <div className="sec-h"><span className="star"><M i="smart_toy" /></span> Command Center Assistant<span className="grow" />
        {msgs.length > 0 && <button className="rbtn" style={{ marginTop: 0 }} onClick={clear}>Clear</button>}
      </div>
      <div className="asslog">
        {loading && <div className="chat-sk"><div className="sk b them" /><div className="sk b me" /></div>}
        {!loading && msgs.length === 0 && (
          <div className="assintro">
            <div className="assintro-h">Ask me anything about your Command Center.</div>
            <div className="assintro-p">I read your live tasks, emails, priorities, categories, projects, and calendar to answer.</div>
            <div className="asschips">{SUGGESTIONS.map((s) => <button key={s} className="asschip" onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => <div className={"amsg " + m.role} key={i}>{m.content}</div>)}
        {busy && <div className="amsg assistant typing">…</div>}
        {proposed.length > 0 && (
          <div className="proposed assproposed">
            <div className="ph">Confirm these actions:</div>
            {proposed.map((a, i) => <div className="pact" key={i}><span className="material-symbols-outlined">{actIcon(a.type)}</span> {a.label}</div>)}
            <div className="pacts">
              <button className="clbtn" onClick={confirm} disabled={confirming}>{confirming ? "Applying…" : `Confirm & apply ${proposed.length}`}</button>
              <button className="mbtn" onClick={() => setProposed([])}>Cancel</button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="assinput">
        <input className="addinp" placeholder="Ask about your tasks, emails, projects, schedule…" value={text} disabled={busy}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} />
        <button className="assend" onClick={() => ask()} disabled={busy}><M i="send" /></button>
      </div>
    </div>
  );
}
