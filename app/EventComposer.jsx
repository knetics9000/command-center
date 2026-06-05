"use client";
import { useState } from "react";

// Local "YYYY-MM-DDTHH:MM" -> ISO instant (interpreted in the browser's timezone).
const toISO = (local) => { const d = new Date(local); return isNaN(d) ? null : d.toISOString(); };
function defaultStart() {
  const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function EventComposer({ summary = "", location = "", start = "", durationMin = 60, loading = false, onClose }) {
  const [s, setS] = useState(summary);
  const [loc, setLoc] = useState(location);
  const [st, setSt] = useState(start || defaultStart());
  const [dur, setDur] = useState(durationMin || 60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function confirm() {
    const startISO = toISO(st); if (!startISO || !s.trim()) return;
    const endISO = new Date(new Date(st).getTime() + dur * 60000).toISOString();
    setSaving(true);
    try {
      const r = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", events: [{ summary: s.trim(), location: loc.trim(), start: startISO, end: endISO }] }) });
      const j = await r.json();
      if (j.ok) { setSaved(true); setTimeout(() => onClose && onClose(true), 1200); }
      else alert("Add failed: " + (j.error || r.status));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="evcomp"><span className="bodyload">Reading the email for a date…</span></div>;
  if (saved) return <div className="evcomp"><span className="savedtag">✓ Added to your personal calendar</span></div>;

  return (
    <div className="evcomp">
      <div className="evrow"><label>Title</label><input value={s} onChange={(e) => setS(e.target.value)} /></div>
      <div className="evrow"><label>When</label>
        <input type="datetime-local" value={st} onChange={(e) => setSt(e.target.value)} />
        <select value={dur} onChange={(e) => setDur(Number(e.target.value))}>
          <option value={30}>30 min</option><option value={60}>1 hr</option><option value={90}>1.5 hr</option><option value={120}>2 hr</option>
        </select>
      </div>
      <div className="evrow"><label>Where</label><input value={loc} placeholder="optional" onChange={(e) => setLoc(e.target.value)} /></div>
      <div className="evacts">
        <button className="clbtn" onClick={confirm} disabled={saving}>{saving ? "Adding…" : "Add to calendar"}</button>
        <button className="mbtn" onClick={() => onClose && onClose(false)}>Cancel</button>
        <span className="replyhint">Lands on your personal calendar.</span>
      </div>
    </div>
  );
}
