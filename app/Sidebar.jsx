"use client";
import { useState, useEffect } from "react";
import Icon from "./Icon";

const NAV = [
  { id: "sec-briefing", label: "Briefing", icon: "sparkle" },
  { id: "sec-projects", label: "Projects", icon: "target" },
  { id: "sec-todo", label: "To-Do", icon: "check" },
  { id: "sec-calendar", label: "Calendar", icon: "calendar" },
  { id: "sec-inbox", label: "Inbox", icon: "inbox" },
];

export default function Sidebar({ connected, email, pic }) {
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

  return (
    <aside className="sidebar">
      <div className="sb-brand"><span className="sb-mark">◆</span> Command<span className="sb-brand-2">Center</span></div>
      <nav className="sb-nav">
        {NAV.map((n) => (
          <button key={n.id} className={"sb-item" + (active === n.id ? " on" : "")} onClick={() => go(n.id)}>
            <Icon name={n.icon} size={17} /> <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="sb-foot">
        <div className="sb-status"><span className={"sb-dot" + (connected ? " ok" : "")} />{connected ? "All connected" : <a href="/connect">Connect →</a>}</div>
        <div className="sb-user">
          {pic ? <img className="sb-av img" src={pic} alt="" referrerPolicy="no-referrer" /> : <span className="sb-av">KW</span>}
          <div className="sb-uwrap"><div className="sb-uname">Kurt</div><div className="sb-umail">{email || "kingkurt1978@gmail.com"}</div></div>
        </div>
      </div>
    </aside>
  );
}
