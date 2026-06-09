"use client";
import { useState, useEffect } from "react";
import Widget from "./Widget";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const Row = ({ label, val }) => <div className="hp-row"><span className="hp-lbl">{label}</span><span className="hp-val">{val == null ? "—" : val}</span></div>;

export default function HealthCard() {
  const [h, setH] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setH).catch(() => setH({ connected: false })); }, []);
  async function refresh() { setLoading(true); try { const j = await fetch("/api/health", { method: "POST" }).then((r) => r.json()); setH(j); } finally { setLoading(false); } }

  const connected = h && h.connected;
  const preview = h === null
    ? <span className="wmuted">…</span>
    : !connected
      ? <span className="wmuted">Not connected</span>
      : <span className="hp-prev">{h.steps != null ? Number(h.steps).toLocaleString() + " steps" : "—"}{h.restingHr != null ? " · " + h.restingHr + " bpm" : ""}</span>;

  return (
    <Widget icon="favorite" accent="red" title="Health Pulse" preview={preview}>
      {connected ? (
        <>
          <Row label="Steps" val={h.steps != null ? Number(h.steps).toLocaleString() : null} />
          <Row label="Resting HR" val={h.restingHr != null ? h.restingHr + " bpm" : null} />
          <Row label="Sleep" val={h.sleepHours != null ? h.sleepHours + " h" : null} />
          <Row label="Active min" val={h.activeMinutes} />
          <Row label="Weight" val={h.weight != null ? h.weight + " lb" : null} />
          <button className="mbtn" onClick={refresh}>{loading ? "…" : <><M i="refresh" /> Refresh</>}</button>
        </>
      ) : (
        <div className="wmuted">Connect Google Health to see steps, sleep, heart rate and weight. <a href="/api/health/start">Connect →</a></div>
      )}
    </Widget>
  );
}
