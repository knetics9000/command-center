"use client";
import { useState, useEffect, useRef } from "react";
import { useTabs } from "./Tabs";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const MOODS = ["quick win", "deep focus", "low energy", "errand", "creative"];
const PRIO = { high: "p-high", medium: "p-med", low: "p-low" };
const RANK = { high: 0, medium: 1, low: 2 };

const appLabel = (a) => { const s = (a || "").split(".").pop() || "Phone"; return s.charAt(0).toUpperCase() + s.slice(1); };

export default function Realign({ emails = [], tasks = [], dismissed = [], notifs = [] }) {
  const { toast } = useToast();
  const { setTab } = useTabs();
  const [items, setItems] = useState([]);     // processed captures
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState(null);
  const [dis, setDis] = useState(new Set(dismissed));   // dismissed item keys
  const [nDis, setNDis] = useState(new Set());          // dismissed flagged-notification ids
  const [showDis, setShowDis] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const load = () => fetch("/api/capture").then((r) => r.json()).then((j) => setItems(j.ok ? j.captures.filter((c) => !c.done && c.status === "processed") : [])).catch(() => {});
  useEffect(() => { load(); }, []);

  async function capture() {
    const t = text.trim(); if (!t || busy) return;
    setBusy(true); setText("");
    try {
      const j = await fetch("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw_text: t, source: listening ? "mic" : "text" }) }).then((r) => r.json());
      if (j.ok && j.capture) { setItems((x) => [j.capture, ...x]); toast("Captured ✓"); } else toast({ message: j.error || "Failed", tone: "error" });
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

  function doneCapture(id) { setItems((x) => x.filter((i) => i.id !== id)); fetch("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "done", id }) }); toast("Done ✓"); }
  // Non-destructive: hide an email/task from Right Now (the item itself is untouched).
  const dKey = (it) => (it.kind === "capture" || it.kind === "notification" ? null : "now:" + it.kind[0] + it.id);
  function dismissItem(it) {
    if (it.kind === "notification") {   // dismiss the actual notification
      setNDis((s) => new Set(s).add(it.id));
      fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dismiss", id: it.id }) });
      toast("Dismissed");
      return;
    }
    const k = dKey(it); if (!k) return;
    setDis((s) => new Set(s).add(k));
    fetch("/api/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k }) });
    toast("Dismissed");
  }
  function restoreItem(it) {
    const k = dKey(it); if (!k) return;
    setDis((s) => { const n = new Set(s); n.delete(k); return n; });
    fetch("/api/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, undo: true }) });
    toast("Restored");
  }
  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const today = new Date().toLocaleDateString("en-CA");
  const bucket = (s) => (s >= 70 ? "high" : s >= 40 ? "medium" : "low");
  const capturedTaskIds = new Set(items.map((c) => c.task_id).filter(Boolean)); // avoid showing a task twice
  const capScore = (c) => (Number.isFinite(c.priority_score) ? c.priority_score : c.priority === "high" ? 80 : c.priority === "low" ? 30 : 55);
  const taskScore = (t) => (t.due ? (t.due < today ? 92 : t.due === today ? 82 : 60) : 45);
  const merged = [
    ...notifs.filter((n) => !nDis.has(n.id)).map((n) => { const sc = Number.isFinite(n.importance) ? n.importance : 85; return ({ key: "n" + n.id, kind: "notification", id: n.id, score: sc, priority: bucket(sc), title: (n.title ? n.title + ": " : "") + (n.body || ""), action: n.why || ("from " + appLabel(n.app)), mood: "errand", tag: n.category || appLabel(n.app) }); }),
    ...items.map((c) => { const sc = capScore(c); return ({ key: "c" + c.id, kind: "capture", score: sc, priority: bucket(sc), title: c.summary, action: c.suggested_action, mood: c.mood_energy, tag: c.category, id: c.id }); }),
    ...emails.map((e) => ({ key: "e" + e.id, kind: "email", id: e.id, score: 85, priority: "high", title: e.subject, action: e.action || "Reply / handle", mood: "deep focus", tag: e.sender })),
    ...tasks.filter((t) => !capturedTaskIds.has(t.id)).map((t) => { const sc = taskScore(t); return ({ key: "t" + t.id, kind: "task", id: t.id, score: sc, priority: bucket(sc), title: t.text, action: t.due ? (t.due <= today ? "Overdue — handle it" : "Due " + t.due) : "Do it", mood: "quick win", tag: (t.tags || "").split(";")[0].trim() }); }),
  ];
  const shown = merged.filter((i) => !mood || i.mood === mood).filter((i) => { const k = dKey(i); return !k || !dis.has(k); }).sort((a, b) => b.score - a.score);
  const dismissedItems = merged.filter((i) => { const k = dKey(i); return k && dis.has(k); });

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

      <div className="now-h"><span className="now-title"><M i="bolt" /> Right now</span><span className="now-count">{shown.length}</span><span className="grow" />
        <div className="moodchips">
          <button className={"moodchip" + (!mood ? " on" : "")} onClick={() => setMood(null)}>All</button>
          {MOODS.map((m) => <button key={m} className={"moodchip" + (mood === m ? " on" : "")} onClick={() => setMood(mood === m ? null : m)}>{m}</button>)}
        </div>
      </div>

      {shown.length === 0 && <div className="wmuted realign-empty">{mood ? `Nothing tagged "${mood}" right now.` : "You're clear — dump a thought above or check back later."}</div>}
      <div className="nowlist">
        {shown.map((it) => (
          <div className={"nowitem " + (PRIO[it.priority] || "p-med")} key={it.key}>
            {it.kind === "capture"
              ? <button className="now-done" title="Mark done" onClick={() => doneCapture(it.id)}><M i="radio_button_unchecked" /></button>
              : <span className={"now-kind" + (it.kind === "notification" ? " flagged" : "")}><M i={it.kind === "email" ? "mail" : it.kind === "notification" ? "notifications_active" : "task_alt"} /></span>}
            <div className={"now-body" + (it.kind === "email" || it.kind === "task" ? " clickable" : "")} onClick={() => { if (it.kind === "email") go("inbox"); if (it.kind === "task") go("todo"); }}>
              <div className="now-sum">{it.title}</div>
              {it.action && <div className="now-act">→ {it.action}</div>}
              <div className="now-meta">
                <span className={"now-pri " + (PRIO[it.priority] || "p-med")}>{it.priority}</span>
                <span className="now-cat">{it.kind}</span>
                {it.mood && <span className="now-mood">{it.mood}</span>}
                {it.tag && <span className="now-cat">{it.tag}</span>}
              </div>
            </div>
            {it.kind !== "capture" && <button className="now-dismiss" title="Dismiss from Right Now" onClick={(e) => { e.stopPropagation(); dismissItem(it); }}><M i="close" /></button>}
          </div>
        ))}
      </div>

      {dismissedItems.length > 0 && (
        <div className="dismissed-zone">
          <button className="dismissed-toggle" onClick={() => setShowDis((v) => !v)}>{dismissedItems.length} dismissed {showDis ? "▴" : "▾"}</button>
          {showDis && (
            <div className="nowlist">
              {dismissedItems.map((it) => (
                <div className="nowitem dismissed" key={it.key}>
                  <span className="now-kind"><M i={it.kind === "email" ? "mail" : "task_alt"} /></span>
                  <div className="now-body"><div className="now-sum">{it.title}</div></div>
                  <button className="now-dismiss" title="Restore to Right Now" onClick={() => restoreItem(it)}><M i="undo" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
