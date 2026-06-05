"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const tagFor = (name) => (/project/i.test(name) ? name : name + " Project").toLowerCase();
const when = (ts) => { const d = new Date((ts || "").replace(" ", "T") + "Z"); return isNaN(d) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

export default function Briefing({ briefing, existingTags = [] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState({});
  const b = briefing;

  async function regenerate() {
    setBusy(true);
    try { await fetch("/api/briefing", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); router.refresh(); }
    finally { setBusy(false); }
  }
  async function createProject(c) {
    setCreating((s) => ({ ...s, [c.name]: true }));
    try {
      const r = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name: c.name, clusterId: c.id }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); alert("Create failed: " + (j.error || r.status)); }
      router.refresh();
    } finally { setCreating((s) => { const n = { ...s }; delete n[c.name]; return n; }); }
  }

  const pill = (u) => <span className={"upill " + (u || "soon")}>{u || "soon"}</span>;

  return (
    <div className="card full briefcard">
      <div className="sec-h">
        <span className="star">✦</span> {b && b.is_primary ? "Morning Briefing" : "Briefing"}
        <span className="grow" />
        {b && b.generated_at && <span className="bts">updated {when(b.generated_at)}</span>}
        <button className="rbtn" style={{ marginTop: 0, marginLeft: 10 }} onClick={regenerate} disabled={busy}>{busy ? "Thinking…" : "↻ Regenerate"}</button>
      </div>

      {!b && <div style={{ color: "var(--muted)" }}>No briefing yet. Hit Regenerate to generate today's.</div>}

      {b && <>
        <div className="greet">{b.greeting}</div>
        <div className="prios">
          {(b.priorities || []).map((p, i) => (
            <div className="prio" key={i}>
              <span className="pnum">{i + 1}</span>
              <div><div className="pt">{p.title} {pill(p.urgency)}</div><div className="pd">{p.detail}</div></div>
            </div>
          ))}
        </div>

        {(b.clusters || []).length > 0 && (
          <div className="clusters">
            <div className="clbl">Themes</div>
            {b.clusters.map((c, i) => {
              const tracked = existingTags.includes(tagFor(c.name));
              return (
                <div className="cl" key={i}>
                  <div className="clmain"><span className="cln">{c.name}</span><span className="cls">{c.summary}</span></div>
                  <span className="clmeta">{(c.taskIds || []).length}t · {(c.emailIds || []).length}e</span>
                  {c.suggestProject && (tracked
                    ? <span className="cltracked">tracked ✓</span>
                    : <button className="clbtn" onClick={() => createProject(c)} disabled={creating[c.name]}>{creating[c.name] ? "…" : "+ Project"}</button>)}
                </div>
              );
            })}
          </div>
        )}
      </>}
    </div>
  );
}
