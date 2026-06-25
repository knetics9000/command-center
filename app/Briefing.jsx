"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import Icon from "./Icon";
import RelatedDrawer from "./RelatedDrawer";

const tagFor = (name) => (/project/i.test(name) ? name : name + " Project").toLowerCase();
const sig = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);   // must match lib/dismiss.js
const when = (ts) => { const d = new Date((ts || "").replace(" ", "T") + "Z"); return isNaN(d) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

export default function Briefing({ briefing, existingTags = [], dismissed = [] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState({});
  const [openPrio, setOpenPrio] = useState(null);
  const [deltaOpen, setDeltaOpen] = useState(false);
  const [openTheme, setOpenTheme] = useState(null);
  const [dbody, setDbody] = useState({});
  const [dis, setDis] = useState(new Set(dismissed.filter((k) => k.startsWith("brief:"))));
  const [showDis, setShowDis] = useState(false);
  const b = briefing;

  function dismissPrio(p) {
    const k = "brief:" + sig(p.title);
    setDis((s) => new Set(s).add(k));
    fetch("/api/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k }) });
    toast("Dismissed");
  }
  function restorePrio(p) {
    const k = "brief:" + sig(p.title);
    setDis((s) => { const n = new Set(s); n.delete(k); return n; });
    fetch("/api/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, undo: true }) });
    toast("Restored");
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
        {b.family && ((b.family.kids || []).length > 0 || (b.family.alerts || []).length > 0) && (
          <div className="brief-fam">
            <div className="clbl">Family &amp; alerts</div>
            {(b.family.kids || []).map((k, i) => <div className="fam-row" key={"k" + i}><span className="fam-ic">👪</span><b>{k.kid}</b> — {k.subject}{k.why ? <span className="fam-why"> · {k.why}</span> : null}</div>)}
            {(b.family.alerts || []).map((a, i) => <div className="fam-row" key={"a" + i}><span className="fam-ic">🚩</span>{a.title}{a.why ? <span className="fam-why"> · {a.why}</span> : null}</div>)}
          </div>
        )}
        {b.thoughts && b.thoughts.count > 0 && (
          <div className="fam-row brief-thoughts"><span className="fam-ic">💭</span>{b.thoughts.count} recent thought{b.thoughts.count > 1 ? "s" : ""}{(b.thoughts.recent || [])[0]?.bullet ? <span className="fam-why"> · {b.thoughts.recent[0].bullet}</span> : null}</div>
        )}
        {(() => {
          const all = b.priorities || [];
          const visible = all.filter((p) => !dis.has("brief:" + sig(p.title)));
          const gone = all.filter((p) => dis.has("brief:" + sig(p.title)));
          return (
            <div className="prios">
              {visible.map((p, i) => (
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
              {gone.length > 0 && (
                <div className="dismissed-zone">
                  <button className="dismissed-toggle" onClick={() => setShowDis((v) => !v)}>{gone.length} dismissed {showDis ? "▴" : "▾"}</button>
                  {showDis && gone.map((p, i) => (
                    <div className="prio dismissed" key={"d" + i}>
                      <div className="pgrow"><div className="pt">{p.title}</div></div>
                      <button className="prio-x restore" title="Restore" onClick={() => restorePrio(p)}><span className="material-symbols-outlined">undo</span></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

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
