"use client";
import { useState, useEffect, useRef } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const MOODS = ["quick win", "deep focus", "low energy", "errand", "creative"];
const PRIO = { high: "p-high", medium: "p-med", low: "p-low" };

export default function Realign() {
  const { toast } = useToast();
  const [items, setItems] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const load = () => fetch("/api/capture").then((r) => r.json()).then((j) => setItems(j.ok ? j.captures.filter((c) => !c.done && c.status === "processed") : [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  async function capture() {
    const t = text.trim(); if (!t || busy) return;
    setBusy(true); setText("");
    try {
      const j = await fetch("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw_text: t, source: listening ? "mic" : "text" }) }).then((r) => r.json());
      if (j.ok && j.capture) { setItems((x) => [j.capture, ...(x || [])]); toast("Captured ✓"); } else toast({ message: j.error || "Failed", tone: "error" });
    } catch (e) { toast({ message: "Failed: " + e.message, tone: "error" }); } finally { setBusy(false); }
  }

  // --- SPINOFF CANDIDATE: Offload voice capture (browser SpeechRecognition) ---
  function mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Voice isn't supported in this browser"); return; }
    if (listening) { recRef.current && recRef.current.stop(); return; }
    const r = new SR(); recRef.current = r; r.lang = "en-US"; r.interimResults = true; r.continuous = false;
    let final = "";
    r.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const tr = e.results[i][0].transcript; if (e.results[i].isFinal) final += tr; else interim += tr; } setText((final + interim).trim()); };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    setListening(true); r.start();
  }

  function done(id) { setItems((x) => x.filter((i) => i.id !== id)); fetch("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "done", id }) }); toast("Done ✓"); }

  const shown = (items || []).filter((i) => !mood || i.mood_energy === mood);

  return (
    <div className="realign">
      <div className="cap-box">
        <textarea className="cap-ta" rows={2} placeholder="Brain-dump… get the thought out before it's gone. (Enter to capture)" value={text} disabled={busy}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); capture(); } }} />
        <div className="cap-acts">
          <button className={"cap-mic" + (listening ? " on" : "")} onClick={mic} title="Voice capture"><M i={listening ? "stop_circle" : "mic"} /></button>
          <button className="cap-btn" onClick={capture} disabled={busy || !text.trim()}>{busy ? "…" : "Capture"}</button>
        </div>
      </div>

      <div className="now-h"><span className="now-title"><M i="bolt" /> Right now</span><span className="grow" />
        <div className="moodchips">
          <button className={"moodchip" + (!mood ? " on" : "")} onClick={() => setMood(null)}>All</button>
          {MOODS.map((m) => <button key={m} className={"moodchip" + (mood === m ? " on" : "")} onClick={() => setMood(mood === m ? null : m)}>{m}</button>)}
        </div>
      </div>

      {items === null && <div className="wmuted realign-empty">Loading…</div>}
      {items && shown.length === 0 && <div className="wmuted realign-empty">{mood ? `Nothing tagged "${mood}" right now.` : "Nothing captured yet — dump a thought above and I'll sort it."}</div>}
      <div className="nowlist">
        {shown.map((c) => (
          <div className={"nowitem " + (PRIO[c.priority] || "p-med")} key={c.id}>
            <button className="now-done" title="Mark done" onClick={() => done(c.id)}><M i="radio_button_unchecked" /></button>
            <div className="now-body">
              <div className="now-sum">{c.summary}</div>
              {c.suggested_action && <div className="now-act">→ {c.suggested_action}</div>}
              <div className="now-meta"><span className={"now-pri " + (PRIO[c.priority] || "p-med")}>{c.priority}</span><span className="now-cat">{c.category}</span><span className="now-mood">{c.mood_energy}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
