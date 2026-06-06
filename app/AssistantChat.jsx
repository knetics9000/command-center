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
  const endRef = useRef(null);

  useEffect(() => {
    fetch("/api/assistant").then((r) => r.json()).then((j) => { if (j.ok) setMsgs(j.messages || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);

  async function ask(q) {
    const m = (q || text).trim(); if (!m || busy) return;
    setText(""); setMsgs((x) => [...x, { role: "user", content: m }]); setBusy(true);
    try {
      const j = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: m }) }).then((r) => r.json());
      setMsgs((x) => [...x, { role: "assistant", content: j.ok ? j.reply : "⚠ " + (j.error || "failed") }]);
    } catch (e) { setMsgs((x) => [...x, { role: "assistant", content: "⚠ " + e.message }]); }
    finally { setBusy(false); }
  }
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
