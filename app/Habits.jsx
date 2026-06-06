"use client";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

function Ring({ pct, size = 46 }) {
  const done = pct >= 100;
  return (
    <div className="hring" style={{ width: size, height: size, background: `conic-gradient(var(--acc) ${pct * 3.6}deg, var(--paper2) 0deg)` }}>
      <div className="hring-in">{done ? <M i="check" /> : <span>{Math.round(pct)}<i>%</i></span>}</div>
    </div>
  );
}

export default function Habits() {
  const { toast } = useToast();
  const [tmpl, setTmpl] = useState(null);
  const [data, setData] = useState({});

  useEffect(() => {
    fetch("/api/habits").then((r) => r.json()).then((j) => { if (j.ok) { setTmpl(j.template); setData(j.data || {}); } }).catch(() => setTmpl([]));
  }, []);

  function toggle(habitId, subId) {
    setData((d) => {
      const next = { ...d, [habitId]: { ...(d[habitId] || {}), [subId]: !(d[habitId] && d[habitId][subId]) } };
      fetch("/api/habits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: next }) }).catch(() => {});
      return next;
    });
  }

  const habitPct = (h) => { const st = data[h.id] || {}; const n = h.subtasks.length || 1; const c = h.subtasks.filter((s) => st[s.id]).length; return (c / n) * 100; };
  const overall = tmpl && tmpl.length ? Math.round((tmpl.filter((h) => habitPct(h) >= 100).length / tmpl.length) * 100) : 0;

  return (
    <>
      <div className="card habitcard">
        <div className="sec-h"><span className="star"><M i="check_circle" /></span> Daily Habits<span className="grow" />
          <span className="habit-prog"><b>{overall}%</b> today</span>
        </div>
        {tmpl === null && <div className="chat-sk"><div className="sk b them" /><div className="sk b me" /></div>}
        {tmpl && tmpl.length === 0 && <div className="wmuted" style={{ padding: 14 }}>No habits yet. Add some in the habit_template table.</div>}
        <div className="habitgrid">
          {tmpl && tmpl.map((h) => {
            const pct = habitPct(h); const st = data[h.id] || {};
            return (
              <div className={"habit" + (pct >= 100 ? " done" : "")} key={h.id}>
                <div className="habit-top"><Ring pct={pct} /><div className="habit-name">{h.name}</div></div>
                <div className="habit-subs">
                  {h.subtasks.map((s) => (
                    <label className={"habit-sub" + (st[s.id] ? " on" : "")} key={s.id}>
                      <input type="checkbox" checked={!!st[s.id]} onChange={() => toggle(h.id, s.id)} />
                      <span className="habit-box"><M i="check" /></span>{s.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Journal />
    </>
  );
}

function Journal() {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [past, setPast] = useState([]);
  const [showPast, setShowPast] = useState(false);
  const [showRaw, setShowRaw] = useState({});

  useEffect(() => {
    fetch("/api/journal").then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      setPast(j.entries || []);
      const t = (j.entries || []).find((e) => e.date === j.today);
      if (t) { setRaw(t.raw || ""); setSummary(t.summary || ""); }
    }).catch(() => {});
  }, []);

  async function save() {
    if (!raw.trim() || saving) return;
    setSaving(true);
    try {
      const j = await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw }) }).then((r) => r.json());
      if (j.ok) { setSummary(j.summary || ""); toast("Journal saved ✓"); fetch("/api/journal").then((r) => r.json()).then((d) => d.ok && setPast(d.entries || [])); }
      else toast({ message: j.error || "Failed", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="card journalcard">
      <div className="sec-h"><span className="star"><M i="edit_note" /></span> Today's Journal</div>
      <textarea className="journal-ta" rows={5} placeholder="How did today go? What did you accomplish, struggle with, or learn?" value={raw} onChange={(e) => setRaw(e.target.value)} />
      <div className="journal-acts">
        <button className="clbtn" onClick={save} disabled={saving || !raw.trim()}>{saving ? "Summarizing…" : "Save & Summarize"}</button>
        <button className="mbtn" onClick={() => setShowPast((v) => !v)}>{showPast ? "Hide past entries" : "View past entries"}</button>
      </div>
      {summary && <div className="journal-summary"><b>Summary:</b> {summary}</div>}
      {showPast && (
        <div className="journal-past">
          {past.length === 0 && <div className="wmuted">No past entries yet.</div>}
          {past.map((e) => (
            <div className="journal-pe" key={e.date}>
              <div className="journal-pe-h"><b>{new Date(e.date + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</b>
                <button className="linklike" onClick={() => setShowRaw((s) => ({ ...s, [e.date]: !s[e.date] }))}>{showRaw[e.date] ? "Hide raw" : "Show raw"}</button>
              </div>
              <div className="journal-pe-s">{e.summary || <i>No summary</i>}</div>
              {showRaw[e.date] && <div className="journal-pe-r">{e.raw}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
