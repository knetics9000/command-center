"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ProjectChat from "./ProjectChat";
import StandingRules from "./StandingRules";
import ProjectNotes from "./ProjectNotes";
import RelatedDrawer from "./RelatedDrawer";
import { useToast } from "./Toast";
import Icon from "./Icon";

const ringColor = (p) => (p >= 66 ? "#7E9A86" : p >= 33 ? "#E0A23C" : "#D2745A");

export default function Projects({ projects }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState({});     // tag -> bool
  const [text, setText] = useState({});     // tag -> draft
  const [busy, setBusy] = useState({});
  const [relOpen, setRelOpen] = useState({}); // tag -> show workspace intelligence

  async function post(body) {
    const r = await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); toast({ message: "Failed: " + (j.error || r.status), tone: "error" }); }
    router.refresh();
  }
  async function add(tag) {
    const t = (text[tag] || "").trim(); if (!t) return;
    setText((s) => ({ ...s, [tag]: "" }));
    await post({ action: "add", text: t, tag });
  }
  async function check(id) {
    setBusy((b) => ({ ...b, [id]: true }));
    try { await post({ action: "check", id }); } finally { setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
  }

  return (
    <div className="card full">
      <div className="sec-h"><span className="star"><Icon name="target" size={15} /></span> Project Tracker — where you left off</div>
      <div className="projgrid">
        {projects.length === 0 && (
          <div className="emptyhero sm">
            <div className="ehicon">★</div>
            <div className="ehtitle">No projects yet</div>
            <div className="ehsub">Tag any Offload task with a “…Project” tag and it shows up here automatically — or create one from a theme in your briefing above.</div>
          </div>
        )}
        {projects.map((p) => (
          <div className={"proj" + (open[p.tag] ? " exp" : "")} key={p.tag}>
            <div className="pn">{p.name}<span className="badge">{p.open} open</span></div>
            <div className="ring" data-p={p.pct} style={{ background: `conic-gradient(${ringColor(p.pct)} ${p.pct}%, #EEE7D7 0)` }} />
            <div className="meta"><span className="k">Last</span> {p.last}</div>
            <div className="next">Next: {p.next}</div>
            <div className="open">{p.total} total · {p.pct}% done</div>
            <button className="exbtn" onClick={() => setOpen((o) => ({ ...o, [p.tag]: !o[p.tag] }))}>
              {open[p.tag] ? "Hide tasks ▲" : "Open ▾"}
            </button>
            {open[p.tag] && (
              <div className="projtasks">
                {(p.tasks || []).map((it) => (
                  <div className="ptask" key={it.id}>
                    <span className={"cbx" + (busy[it.id] ? " on" : "")} role="button" onClick={() => check(it.id)} />
                    <span>{it.text}{it.synced === 0 && <em className="sync"> · syncing</em>}</span>
                  </div>
                ))}
                {(!p.tasks || p.tasks.length === 0) && <div className="ptask muted">All clear 🌿</div>}
                <div className="addrow">
                  <input className="addinp" placeholder="Add task…" value={text[p.tag] || ""}
                    onChange={(e) => setText((s) => ({ ...s, [p.tag]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") add(p.tag); }} />
                  <button className="addbtn" onClick={() => add(p.tag)}>＋</button>
                </div>
                <div className="wsintel">
                  <button className="wsbtn" onClick={() => setRelOpen((r) => ({ ...r, [p.tag]: !r[p.tag] }))}>
                    {relOpen[p.tag] ? "Hide related emails & summary ▲" : "✦ Related emails, people & AI summary ▾"}
                  </button>
                  {relOpen[p.tag] && <RelatedDrawer title={p.name} projectTag={p.tag} />}
                </div>
                <ProjectNotes contextId={p.tag} />
                <StandingRules contextId={p.tag} />
                <ProjectChat contextId={p.tag} projectName={p.name} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
