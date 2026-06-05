"use client";
import { useState, useEffect } from "react";

const SECTIONS = [
  { id: "sec-briefing", label: "Briefing" },
  { id: "sec-projects", label: "Projects" },
  { id: "sec-todo", label: "To-Do" },
  { id: "sec-inbox", label: "Inbox" },
];

function ago(iso) {
  if (!iso) return "not yet synced";
  const d = new Date(iso.replace(" ", "T") + "Z"); const s = (Date.now() - d) / 1000;
  if (isNaN(s)) return "";
  if (s < 60) return "synced just now";
  if (s < 3600) return `synced ${Math.round(s / 60)}m ago`;
  if (s < 86400) return `synced ${Math.round(s / 3600)}h ago`;
  return `synced ${Math.round(s / 86400)}d ago`;
}

export default function SectionNav({ lastSync }) {
  const [active, setActive] = useState("sec-briefing");
  const [, tick] = useState(0);
  const [compact, setCompact] = useState(false);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    const c = localStorage.getItem("cc_compact") === "1";
    const f = localStorage.getItem("cc_focus") === "1";
    setCompact(c); setFocus(f);
    document.body.classList.toggle("compact", c);
    document.body.classList.toggle("focus", f);
  }, []);
  const toggleCompact = () => setCompact((v) => { const n = !v; document.body.classList.toggle("compact", n); localStorage.setItem("cc_compact", n ? "1" : "0"); return n; });
  const toggleFocus = () => setFocus((v) => { const n = !v; document.body.classList.toggle("focus", n); localStorage.setItem("cc_focus", n ? "1" : "0"); return n; });

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="secnav">
      <div className="secnav-links">
        {SECTIONS.map((s) => (
          <button key={s.id} className={"snlink" + (active === s.id ? " on" : "")} onClick={() => go(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="secnav-right">
        <button className={"vctrl" + (focus ? " on" : "")} onClick={toggleFocus} title="Focus: only Act-Now mail + today's priorities">◎ Focus</button>
        <button className={"vctrl" + (compact ? " on" : "")} onClick={toggleCompact} title="Toggle density">{compact ? "▤ Compact" : "▦ Comfortable"}</button>
        <span className="secnav-sync"><span className="livedot" />{ago(lastSync)}</span>
      </div>
    </div>
  );
}
