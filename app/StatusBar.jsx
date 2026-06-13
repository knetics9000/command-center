"use client";
import { useState, useEffect } from "react";

const rel = (ms) => {
  if (ms == null) return "—";
  const m = Math.round(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h";
  return Math.round(h / 24) + "d";
};

/** Quiet footer heartbeat: every source with how long since it last flowed.
 *  Dot goes amber/red when a source is stale or erroring — the system can't
 *  silently stop delivering and look "all caught up." */
export default function StatusBar() {
  const [s, setS] = useState(null);
  const load = () => fetch("/api/status").then((r) => r.json()).then((j) => setS(j.sources || [])).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, []);
  if (!s) return null;

  return (
    <div className="statusbar">
      {s.map((x) => {
        const tone = x.error ? "err" : x.off ? "off" : x.stale ? "warn" : "ok";
        const title = x.error ? `${x.label}: ${x.error}` : x.off ? `${x.label}: not connected` : `${x.label}: updated ${rel(x.ago)} ago`;
        return (
          <span className={"sb-item sb-" + tone} key={x.key} title={title}>
            <span className="sb-dot" />{x.label} {x.off ? "off" : rel(x.ago)}
          </span>
        );
      })}
    </div>
  );
}
