"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const KIND = {
  caldup: { icon: "event_busy", label: "Duplicate event", cls: "k-caldup" },
  calendar: { icon: "event", label: "Add to calendar", cls: "k-cal" },
  project: { icon: "account_tree", label: "New project", cls: "k-project" },
  duplicate: { icon: "content_copy", label: "Duplicate", cls: "k-dup" },
  mistag: { icon: "sell", label: "Wrong tag", cls: "k-mistag" },
  uncategorized: { icon: "label_off", label: "Uncategorized", cls: "k-uncat" },
  incomplete: { icon: "edit_note", label: "Needs detail", cls: "k-incomplete" },
};
const niceDate = (d, t) => { const x = new Date((d || "") + "T" + (t || "12:00") + ":00"); return isNaN(x) ? d : x.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + (t ? " · " + x.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""); };

function Title({ s }) {
  if (s.kind === "caldup") return <>Delete duplicate event: <b>{s.title}</b> · {niceDate(s.date, s.time)} <span className="k-from">(keep 1)</span></>;
  if (s.kind === "calendar") return <>Add to calendar: <b>{s.title}</b> · {niceDate(s.date, s.time)}</>;
  if (s.kind === "project") return <>Create project <b>{s.name}</b> from <b>{(s.taskIds || []).length}</b> related tasks</>;
  if (s.kind === "duplicate") return <>Merge <b>{(s.dupeIds || []).length + 1}</b> duplicates of “{s.text}”</>;
  if (s.kind === "mistag") return <>Re-tag “{s.text}” · <span className="k-from">{s.current}</span> → <b>{s.suggested}</b></>;
  if (s.kind === "uncategorized") return <>Categorize “{s.text}” as <b>{s.suggested}</b></>;
  if (s.kind === "incomplete") return <>Clarify “{s.text}” → <b>{s.suggestedText}</b></>;
  return <>{s.text}</>;
}

export default function CleanupView() {
  const router = useRouter();
  const { toast } = useToast();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState({});
  const [running, setRunning] = useState(false);

  const load = () => fetch("/api/cleanup").then((r) => r.json()).then((j) => { if (j.ok) setList(j.suggestions || []); }).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  async function run() {
    setRunning(true);
    try {
      const j = await fetch("/api/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "run" }) }).then((r) => r.json());
      if (j.ok) { setList(j.suggestions || []); toast(`Scan complete — ${(j.suggestions || []).length} suggestions`); }
      else toast({ message: j.error || "Scan failed", tone: "error" });
    } finally { setRunning(false); }
  }
  async function act(id, action) {
    setBusy((b) => ({ ...b, [id]: action }));
    try {
      const j = await fetch("/api/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) }).then((r) => r.json());
      if (j.ok) { setList(j.suggestions || []); toast(action === "accept" ? "Applied ✓" : "Dismissed"); if (action === "accept") router.refresh(); }
      else toast({ message: j.error || "Failed", tone: "error" });
    } finally { setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
  }

  return (
    <div className="card cleanupcard">
      <div className="sec-h"><span className="star"><M i="auto_fix_high" /></span> AI Cleanup Organizer<span className="grow" />
        {list && <span className="cl-count">{list.length} suggestions</span>}
        <button className="rbtn" style={{ marginTop: 0, marginLeft: 10 }} onClick={run} disabled={running}>{running ? "Scanning…" : "↻ Re-scan tasks"}</button>
      </div>
      <p className="cl-intro">I review your tasks and emails for duplicates, wrong tags, vague items, clusters that should become projects, and <b>dated commitments to add to your calendar</b> (e.g. "domain expires June 20"). Apply a fix or dismiss it — dismissed items won't come back, and your choices teach me your style.</p>

      {list === null && <div className="chat-sk"><div className="sk b them" /><div className="sk b me" /><div className="sk b them" /></div>}
      {list && list.length === 0 && (
        <div className="emptyhero sm"><div className="ehicon">✨</div><div className="ehtitle">All organized</div><div className="ehsub">Nothing to clean up right now. Hit “Re-scan tasks” after things change.</div></div>
      )}
      {list && list.map((s) => {
        const k = KIND[s.kind] || KIND.incomplete;
        return (
          <div className={"clsug " + k.cls} key={s.id}>
            <span className="clsug-ic"><M i={k.icon} /></span>
            <div className="clsug-body">
              <div className="clsug-kind">{k.label}</div>
              <div className="clsug-title"><Title s={s} /></div>
              <div className="clsug-why">{s.why}</div>
            </div>
            <div className="clsug-acts">
              {busy[s.id]
                ? <span className="mwait">{busy[s.id] === "accept" ? "Applying…" : "…"}</span>
                : <>
                    <button className="clbtn" onClick={() => act(s.id, "accept")}>Apply</button>
                    <button className="mbtn" onClick={() => act(s.id, "dismiss")}>Dismiss</button>
                  </>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
