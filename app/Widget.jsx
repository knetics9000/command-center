"use client";
import { useState } from "react";
import { useTabs } from "./Tabs";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

/**
 * Uniform dashboard tile. Collapsed: icon + title + count + a compact preview.
 * Click the header to expand in place and reveal the full content (children).
 * An optional "Open <tab>" button routes to the dedicated tab from the expansion.
 */
export default function Widget({
  icon, accent = "", title, count = null, countTone = "",
  preview = null, children = null, openTab = null, openLabel = "Open",
  defaultOpen = false, span = 1,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { setTab } = useTabs();
  const go = () => { setTab(openTab); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className={"w2" + (open ? " open" : "") + (span === 2 ? " w2-wide" : "")}>
      <button className="w2-head" onClick={() => setOpen((o) => !o)}>
        <span className={"wicon " + accent}>{icon && <M i={icon} />}</span>
        <span className="wtitle">{title}</span>
        {count != null && <span className={"wcount " + countTone}>{count}</span>}
        <span className={"w2-chev" + (open ? " open" : "")}>▸</span>
      </button>
      {!open && preview != null && <div className="w2-body w2-prev">{preview}</div>}
      {open && (
        <div className="w2-body w2-full">
          {children}
          {openTab && <button className="w2-open" onClick={go}>{openLabel} <M i="arrow_forward" /></button>}
        </div>
      )}
    </div>
  );
}
