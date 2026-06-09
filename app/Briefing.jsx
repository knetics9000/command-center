"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import Icon from "./Icon";
import RelatedDrawer from "./RelatedDrawer";

const tagFor = (name) => (/project/i.test(name) ? name : name + " Project").toLowerCase();
const sig = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);   // must match lib/dismiss.js
const when = (ts) => { const d = new Date((ts || "").replace(" ", "T") + "Z"); return isNaN(d) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

export default function Briefing({ briefing, existingTags = [] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState({});
  const [openPrio, setOpenPrio] = useState(null);
  const [deltaOpen, setDeltaOpen] = useState(false);
  const [openTheme, setOpenTheme] = useState(null);
  const [dbody, setDbody] = useState({});
  const [hidden, setHidden] = useState(new Set());   // just-dismissed priorities (server filters persisted ones)
  const b = briefing;

  function dismissPrio(p) {
    const s = sig(p.title);
    setHidden((h) => new Set(h).add(s));
    fetch("/api/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "brief:" + s }) });
    toast("Dismissed");
  }

  async function openDeltaItem(e) {
    if (!e.id || !e.account) return;
    if (dbody[e.id]) { setDbody((x) => { const n = { ...x }; delete n[e.id]; return n; }); return; }
    setDbody((x) => ({ ...x, [e.id]: "loading" }));
    try {
      const r = await fetch(`/api/inbox/body?account=${e.account}&id=${e.id}`);
      const j = await r.json();
      setDbody((x) => ({ ...x, [e.id]: j.ok ? (j.body || "(empty)") : "⚠ " + (j.error || "failed") }));
    } catch (err) { setDbody((x) => ({ ...x, [e.id]: "⚠ " + err.message })); }
  }

  async function regenerate() {
    setBusy(true);
    try { await fetch("/api/briefing", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); router.refresh(); }
    finally { setBusy(false); }
  }
  async function createProject(c) {
    setCreating((s) => ({ ...s, [c.name]: true }));
    try {
      const r = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name: c.name, clusterId: c.id }) });
      if (r.ok) toast("✦ Project created"); else { const j = await r.json().catch(() => ({})); toast({ message: "Create failed: " + (j.error || r.status), tone: "error" }); }
      router.refresh();
    } finally { setCreating((s) => { const n = { ...s }; delete n[c.name]; return n; }); }
  }

  const pill = (u) => <span className={"upill " + (u || "soon")}>{u || "soon"}</span>;

  return (
    <div className="card full briefcard">
      <div className="sec-h">
        <span className="star"><Icon name="sparkle" size={15} /></span> {b && b.is_primary ? "Morning Briefing" : "Briefing"}
        <span className="grow" />
        {b && b.generated_at && <span className="bts">updated {when(b.generated_at)}</span>}
        <button className="rbtn" style={{ marginTop: 0, marginLeft: 10 }} onClick={regenerate} disabled={busy}>{busy ? "Thinking…" : "↻ Regenerate"}</button>
      </div>

      {!b && (
        <div className="emptyhero">
          <div className="ehicon">✦</div>
          <div className="ehtitle">No briefing yet</div>
          <div className="ehsub">I'll mine your open tasks and unread mail, cluster them by theme, and hand you a short prioritized plan for the day.</div>
          <button className="ehbtn" onClick={regenerate} disabled={busy}>{busy ? "Thinking…" : "Generate today's briefing"}</button>
        </div>
      )}

      {b && <>
        <div className="greet">{b.greeting}</div>
        {b.delta && (() => {
          const drillable = b.delta.newAct && b.delta.newAct.length > 0;
          return (
            <div className="deltawrap">
              <div className={"delta" + (drillable ? " clickable" : "")} onClick={() => drillable && setDeltaOpen((v) => !v)}>
                <span className="dlbl">Since last briefing</span>
                {b.delta.newActCount > 0 && <span className="dpill now">{b.delta.newActCount} new urgent</span>}
                {b.delta.cleared > 0 && <span className="dpill good">{b.delta.cleared} cleared</span>}
                {b.delta.ruleEvents > 0 && <span className="dpill cal">{b.delta.ruleEvents} event{b.delta.ruleEvents > 1 ? "s" : ""} added</span>}
                {drillable && <span className="dnew">· {b.delta.newAct.map((e) => e.sender).join(", ")}</span>}
                {drillable && <span className={"priocaret" + (deltaOpen ? " open" : "")}>▸</span>}
              </div>
              {deltaOpen && drillable && (
                <>
                  <div className="deltadrill">
                    <div className="relbh">New since last briefing</div>
                    {b.delta.newAct.map((e, i) => (
                      <div key={i}>
                        <div className={"relrow" + (e.id ? " clickable" : "")} onClick={() => openDeltaItem(e)}>
                          {e.id && <span className={"relcaret" + (dbody[e.id] ? " open" : "")}>▸</span>}
                          <span className="reldot" style={{ background: "#D2745A" }} /><span className="relsnd">{e.sender}</span> {e.subject}
                        </div>
                        {e.id && dbody[e.id] && <div className="relbody">{dbody[e.id] === "loading" ? <span className="bodyload">Loading…</span> : dbody[e.id]}</div>}
                      </div>
                    ))}
                  </div>
                  <RelatedDrawer title={b.delta.newAct.map((e) => e.subject).join(" ")} />
                </>
              )}
            </div>
          );
        })()}
        <div className="prios">
          {(b.priorities || []).filter((p) => !hidden.has(sig(p.title))).map((p, i) => (
            <div key={i}>
              <div className={"prio clickable" + (openPrio === i ? " open" : "")} onClick={() => setOpenPrio((x) => x === i ? null : i)}>
                <span className="pnum">{i + 1}</span>
                <div className="pgrow"><div className="pt">{p.title} {pill(p.urgency)}</div><div className="pd">{p.detail}</div></div>
                <button className="prio-x" title="Dismiss" onClick={(e) => { e.stopPropagation(); dismissPrio(p); }}><span className="material-symbols-outlined">close</span></button>
                <span className={"priocaret" + (openPrio === i ? " open" : "")}>▸</span>
              </div>
              {openPrio === i && <RelatedDrawer title={p.title + " — " + p.detail} />}
            </div>
          ))}
        </div>

        {(b.clusters || []).length > 0 && (
          <div className="clusters">
            <div className="clbl">Themes</div>
            {b.clusters.map((c, i) => {
              const tracked = existingTags.includes(tagFor(c.name));
              return (
                <div key={i}>
                  <div className="cl">
                    <div className="clmain clickable" onClick={() => setOpenTheme((x) => x === i ? null : i)}>
                      <span className={"priocaret" + (openTheme === i ? " open" : "")}>▸</span>
                      <span className="cln">{c.name}</span><span className="cls">{c.summary}</span>
                    </div>
                    <span className="clmeta">{(c.taskIds || []).length}t · {(c.emailIds || []).length}e</span>
                    {c.suggestProject && (tracked
                      ? <span className="cltracked">tracked ✓</span>
                      : <button className="clbtn" onClick={() => createProject(c)} disabled={creating[c.name]}>{creating[c.name] ? "…" : "+ Project"}</button>)}
                  </div>
                  {openTheme === i && <RelatedDrawer title={c.name + " " + (c.summary || "")} projectTag={tracked ? tagFor(c.name).replace(/ project$/, " Project") : ""} />}
                </div>
              );
            })}
          </div>
        )}
      </>}
    </div>
  );
}
