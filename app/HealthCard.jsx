"use client";
import { useState, useEffect } from "react";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const Row = ({ label, val }) => <div className="hp-row"><span className="hp-lbl">{label}</span><span className="hp-val">{val == null ? "—" : val}</span></div>;

export default function HealthCard() {
  const [h, setH] = useState(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setH).catch(() => setH({ connected: false })); }, []);
  async function refresh() { setLoading(true); try { const j = await fetch("/api/health", { method: "POST" }).then((r) => r.json()); setH(j); } finally { setLoading(false); } }

  const connected = h && h.connected;

  return (
    <div className={"stat healthcard" + (shown ? " on" : "")}>
      {h === null ? (
        <div className="hp-hidden"><div className="hp-title"><M i="favorite" /> Health Pulse</div><span className="hp-dim">…</span></div>
      ) : !connected ? (
        <div className="hp-hidden"><div className="hp-title"><M i="favorite" /> Health Pulse</div><a className="clbtn" href="/api/health/start">Connect</a></div>
      ) : !shown ? (
        <div className="hp-hidden"><div className="hp-title"><M i="favorite" /> Health Pulse</div><button className="clbtn" onClick={() => { setShown(true); if (!h.fetchedAt) refresh(); }}>Reveal</button></div>
      ) : (
        <div className="hp-shown">
          <div className="hp-head"><span className="hp-title sm"><M i="favorite" /> Health Pulse</span>
            <span className="hp-tools">
              <button className="iconbtn" title="Refresh" onClick={refresh}><M i={loading ? "hourglass_empty" : "refresh"} /></button>
              <button className="iconbtn" title="Hide" onClick={() => setShown(false)}><M i="visibility_off" /></button>
            </span>
          </div>
          <Row label="Steps" val={h.steps != null ? Number(h.steps).toLocaleString() : null} />
          <Row label="Resting HR" val={h.restingHr != null ? h.restingHr + " bpm" : null} />
          <Row label="Sleep" val={h.sleepHours != null ? h.sleepHours + " h" : null} />
          <Row label="Active min" val={h.activeMinutes} />
          <Row label="Weight" val={h.weight != null ? h.weight + " lb" : null} />
        </div>
      )}
    </div>
  );
}
