"use client";
import { useState, useEffect, useRef } from "react";
import { useToast } from "./Toast";

const fmt = (iso) => { const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };

export default function ProjectChat({ contextId, projectName }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposed, setProposed] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const endRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/chat?contextId=" + encodeURIComponent(contextId))
      .then((r) => r.json()).then((j) => { if (j.ok) setMsgs(j.messages || []); }).catch(() => {}).finally(() => setLoading(false));
  }, [contextId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs, proposed]);

  async function send() {
    const m = text.trim(); if (!m || busy) return;
    setText(""); setProposed([]);
    setMsgs((x) => [...x, { role: "user", content: m }]);
    setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contextId, projectName, message: m }) });
      const j = await r.json();
      if (j.ok) { setMsgs((x) => [...x, { role: "assistant", content: j.reply }]); setProposed(j.proposedEvents || []); }
      else setMsgs((x) => [...x, { role: "assistant", content: "⚠ " + (j.error || "failed") }]);
    } catch (e) { setMsgs((x) => [...x, { role: "assistant", content: "⚠ " + e.message }]); }
    finally { setBusy(false); }
  }

  async function confirm() {
    setConfirming(true);
    try {
      const r = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", events: proposed, contextId }) });
      const j = await r.json();
      if (j.ok) { setMsgs((x) => [...x, { role: "assistant", content: `✓ Added ${j.created.length} event(s) to your calendar.` }]); setProposed([]); toast("📅 Events added to your calendar"); }
      else toast({ message: "Create failed: " + (j.error || r.status), tone: "error" });
    } finally { setConfirming(false); }
  }

  return (
    <div className="chat">
      <div className="chatlog">
        {loading && <div className="chat-sk"><div className="sk b them" /><div className="sk b me" /><div className="sk b them" /></div>}
        {!loading && msgs.length === 0 && <div className="chempty">Ask me to track schedules, pull details from email, or add events. e.g. “Track all i9 Sports game times and addresses and add them to my calendar.”</div>}
        {msgs.map((m, i) => <div className={"cmsg " + m.role} key={i}>{m.content}</div>)}
        {busy && <div className="cmsg assistant typing">…</div>}
        {proposed.length > 0 && (
          <div className="proposed">
            <div className="ph">Proposed events — confirm to add to your <b>personal</b> calendar:</div>
            {proposed.map((e, i) => (
              <div className="pev" key={i}>
                <div className="ps">{e.summary}</div>
                <div className="pm">{fmt(e.start)}{e.location ? " · " + e.location : ""}</div>
              </div>
            ))}
            <div className="pacts">
              <button className="clbtn" onClick={confirm} disabled={confirming}>{confirming ? "Adding…" : `Confirm & add ${proposed.length}`}</button>
              <button className="mbtn" onClick={() => setProposed([])}>Dismiss</button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="addrow">
        <input className="addinp" placeholder="Message the assistant…" value={text} disabled={busy}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button className="addbtn" onClick={send} disabled={busy}>➤</button>
      </div>
    </div>
  );
}
