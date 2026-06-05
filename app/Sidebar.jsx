"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

const NAV = [
  { id: "sec-briefing", label: "Briefing", icon: "dashboard" },
  { id: "sec-projects", label: "Projects", icon: "account_tree" },
  { id: "sec-todo", label: "To-Do", icon: "checklist" },
  { id: "sec-calendar", label: "Calendar", icon: "calendar_today" },
  { id: "sec-inbox", label: "Inbox", icon: "inbox" },
];
const M = ({ i, fill }) => <span className={"material-symbols-outlined" + (fill ? " fill" : "")}>{i}</span>;

export default function Sidebar({ connected, email, pic }) {
  const router = useRouter();
  const { toast } = useToast();
  const [active, setActive] = useState("sec-briefing");

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-15% 0px -75% 0px", threshold: [0, 0.25, 0.5, 1] });
    NAV.forEach((n) => { const el = document.getElementById(n.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const go = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  async function newProject() {
    const name = window.prompt("New project name"); if (!name || !name.trim()) return;
    try {
      const r = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name: name.trim() }) });
      const j = await r.json();
      if (j.ok) { toast("Project created — " + name.trim()); router.refresh(); setTimeout(() => go("sec-projects"), 200); }
      else toast({ message: "Failed: " + (j.error || ""), tone: "error" });
    } catch (e) { toast({ message: e.message, tone: "error" }); }
  }

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="sb-logo"><M i="bolt" /></span>
        <div className="sb-brandwrap"><div className="sb-bname">Command Center</div><div className="sb-bsub">Personal Hub</div></div>
      </div>
      <nav className="sb-nav">
        {NAV.map((n) => (
          <button key={n.id} className={"sb-item" + (active === n.id ? " on" : "")} onClick={() => go(n.id)}>
            <M i={n.icon} /> <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="sb-foot">
        <button className="sb-newproj" onClick={newProject}><M i="add" /> New Project</button>
        <a className="sb-link" href="/connect"><M i="settings" /> <span>Settings</span></a>
        <a className="sb-link" href="https://github.com" target="_blank" rel="noreferrer"><M i="help" /> <span>Support</span></a>
        <div className="sb-divide" />
        <div className="sb-status"><span className={"sb-dot" + (connected ? " ok" : "")} />{connected ? "All connected" : <a href="/connect">Connect →</a>}</div>
        <div className="sb-user">
          {pic ? <img className="sb-av img" src={pic} alt="" referrerPolicy="no-referrer" /> : <span className="sb-av">KW</span>}
          <div className="sb-uwrap"><div className="sb-uname">Kurt</div><div className="sb-umail">{email || "kingkurt1978@gmail.com"}</div></div>
        </div>
      </div>
    </aside>
  );
}
