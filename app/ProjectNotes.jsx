"use client";
import { useState, useEffect } from "react";

export default function ProjectNotes({ contextId }) {
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/project?tag=" + encodeURIComponent(contextId)).then((r) => r.json())
      .then((j) => { if (j.ok) { setNotes(j.notes || ""); setLoaded(true); setOpen(!!j.notes); } }).catch(() => setLoaded(true));
  }, [contextId]);

  async function save() {
    setSaving(true);
    try { await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", tag: contextId, notes }) }); }
    finally { setSaving(false); }
    setSaved(true); setTimeout(() => setSaved(false), 2200);
  }

  if (!loaded) return null;
  return (
    <div className="pnotes">
      <div className="pnotes-h" onClick={() => setOpen((o) => !o)}>
        📌 Project context {notes ? "" : <span className="pnsub">— help the assistant know this project</span>}
        <span className="grow" />{saved && <span className="savedtag">saved</span>}<span className="pncaret">{open ? "▲" : "▾"}</span>
      </div>
      {open && (
        <>
          <textarea className="pnotes-ta" value={notes} placeholder="Goals, key people, constraints… e.g. 'Humayun is my co-founder; Raz gives design feedback. Launch target end of June.'"
            onChange={(e) => setNotes(e.target.value)} onBlur={save} />
          <div className="pnotes-foot">
            <button className="clbtn" onClick={save} disabled={saving}>{saving ? "Saving…" : saved ? "Saved ✓" : "Save context"}</button>
            <span className="pnotes-hint">Also saves automatically when you click outside the box.</span>
          </div>
        </>
      )}
    </div>
  );
}
