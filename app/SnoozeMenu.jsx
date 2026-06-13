"use client";
import { useState } from "react";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

function presets() {
  const now = new Date();
  const at = (days, h) => { const x = new Date(now); x.setDate(x.getDate() + days); x.setHours(h, 0, 0, 0); return x; };
  const tonight = (() => { const x = at(0, 18); return x <= now ? at(1, 18) : x; })();
  const sat = at((6 - now.getDay() + 7) % 7 || 7, 9);   // upcoming Saturday 9am
  const mon = at((1 - now.getDay() + 7) % 7 || 7, 9);   // next Monday 9am
  return [
    { label: "3 hours", until: new Date(now.getTime() + 3 * 3600e3) },
    { label: "Tonight", until: tonight },
    { label: "Tomorrow", until: at(1, 9) },
    { label: "This weekend", until: sat },
    { label: "Next week", until: mon },
  ];
}

/** Small snooze picker. onPick(isoUntil, label). */
export default function SnoozeMenu({ onPick, title = "Snooze" }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="snz">
      <button className="iconbtn" title={title} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}><M i="snooze" /></button>
      {open && (
        <div className="snz-menu" onClick={(e) => e.stopPropagation()}>
          {presets().map((p) => (
            <button key={p.label} onClick={() => { setOpen(false); onPick(p.until.toISOString(), p.label); }}>{p.label}</button>
          ))}
        </div>
      )}
    </span>
  );
}
