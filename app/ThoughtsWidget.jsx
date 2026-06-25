"use client";
import { useState, useEffect } from "react";
import Widget from "./Widget";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const when = (s) => {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d)) return s;
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

/** Offload thoughts: bullet summary up front, full prose one click away, raw
 *  transcript behind a toggle. Reference material — read-only. */
export default function ThoughtsWidget() {
  const [items, setItems] = useState(null);
  const [full, setFull] = useState(new Set());   // show full prose
  const [raw, setRaw] = useState(new Set());     // show original capture

  useEffect(() => { fetch("/api/thoughts").then((r) => r.json()).then((j) => setItems(j.ok ? j.items : [])).catch(() => setItems([])); }, []);
  const toggle = (set, fn, id) => fn((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (items === null) return null;

  const preview = items.length === 0
    ? <span className="wmuted">No thoughts yet — capture one in Offload.</span>
    : <span className="wmuted">{items[0].bullets[0] || items[0].prose.slice(0, 60) || "…"}</span>;

  return (
    <Widget wkey="thoughts" icon="cognition" accent="brief" title="Thoughts" count={items.length || null} preview={preview}>
      {items.length === 0 ? (
        <div className="wmuted">Long-form captures from Offload land here — cleaned into prose and summarized. Nothing yet.</div>
      ) : (
        <div className="thoughts-list">
          {items.map((t) => (
            <div className="thought" key={t.id}>
              <div className="thought-head">
                <span className={"thought-src " + t.source}><M i={t.source === "voice" ? "mic" : "keyboard"} />{t.source === "voice" ? "Voice" : "Typed"}</span>
                <span className="thought-when">{when(t.created_at)}</span>
              </div>
              {t.bullets.length > 0
                ? <ul className="thought-bullets">{t.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                : <div className="thought-prose">{t.prose.slice(0, 160)}</div>}
              <div className="thought-acts">
                {t.prose && <button className="linklike" onClick={() => toggle(full, setFull, t.id)}>{full.has(t.id) ? "Hide full" : "Read full"}</button>}
                {t.raw && <button className="linklike" onClick={() => toggle(raw, setRaw, t.id)}>{raw.has(t.id) ? "Hide original" : "Show original"}</button>}
              </div>
              {full.has(t.id) && t.prose && <div className="thought-prose open">{t.prose}</div>}
              {raw.has(t.id) && t.raw && <div className="thought-raw">{t.raw}</div>}
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}
