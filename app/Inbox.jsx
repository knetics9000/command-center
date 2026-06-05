"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

function rel(x) {
  const s = (Date.now() - new Date(x)) / 1000; if (isNaN(s)) return "";
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  const d = Math.round(s / 86400); return d < 7 ? d + "d" : new Date(x).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Inbox({ tiers, byTier, risky }) {
  const router = useRouter();
  const [busy, setBusy] = useState({});
  const [expandNoise, setExpandNoise] = useState(false);

  async function act(id, account, action) {
    setBusy((b) => ({ ...b, [id]: action }));
    try {
      const r = await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, account }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); alert("Gmail action failed: " + (j.error || r.status)); }
      router.refresh();
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  }

  const Mail = ({ e }) => (
    <div className={"mail " + e.triage_tier} key={e.id}>
      <div className="mt">
        <span className={"tag " + e.account}>{e.account === "work" ? "Work" : "Personal"}</span>
        <span className="snd">{e.sender}</span><span className="addr">{e.sender_addr}</span>
        <span className="tmm">{rel(e.received_at)}</span>
      </div>
      <div className="subj">{e.subject}</div>
      <div className="why">{e.why}</div>
      {e.action && <div className="nx"><b>Next:</b> {e.action}</div>}
      <div className="mailacts">
        {busy[e.id]
          ? <span className="mwait">{busy[e.id]}…</span>
          : <>
              <button className="mbtn" onClick={() => act(e.id, e.account, "archive")}>Archive</button>
              <button className="mbtn" onClick={() => act(e.id, e.account, "done")}>Done</button>
              <button className="mbtn danger" onClick={() => act(e.id, e.account, "spam")}>Spam</button>
            </>}
      </div>
    </div>
  );

  return (
    <div className="card full" style={{ marginTop: 18 }}>
      <div className="sec-h">Unified Inbox · personal + work</div>
      {risky.length > 0 && (
        <div className="alarm">
          <h3>⚠ Possible phishing / fraud — verify before clicking</h3>
          {risky.map((e) => <div className="it" key={e.id}><b>{e.sender}</b> &lt;{e.sender_addr}&gt; — {e.subject}{e.risk_why ? " · " + e.risk_why : ""}</div>)}
        </div>
      )}
      {tiers.map((t) => {
        const list = byTier[t.key]; if (!list.length) return null;
        const show = t.key === "noise" && !expandNoise ? list.slice(0, 4) : list;
        return (
          <div key={t.key}>
            <div className="tier-h"><span>{t.emoji}</span><span className="n">{t.label}</span><span className="c">{list.length}</span><span className="rl" /></div>
            {show.map((e) => <Mail e={e} key={e.id} />)}
            {t.key === "noise" && list.length > 4 && (
              <button className="morebtn" onClick={() => setExpandNoise((v) => !v)}>
                {expandNoise ? "Show less" : `+${list.length - 4} more`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
