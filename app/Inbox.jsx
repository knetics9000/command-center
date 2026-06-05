"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

function rel(x) {
  const s = (Date.now() - new Date(x)) / 1000; if (isNaN(s)) return "";
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  const d = Math.round(s / 86400); return d < 7 ? d + "d" : new Date(x).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const matches = (e, q) => {
  if (!q) return true; const s = q.toLowerCase();
  return [e.sender, e.sender_addr, e.subject, e.snippet, e.why].some((f) => (f || "").toLowerCase().includes(s));
};

export default function Inbox({ tiers, byTier, risky, handled = [] }) {
  const router = useRouter();
  const [busy, setBusy] = useState({});
  const [expandNoise, setExpandNoise] = useState(false);
  const [q, setQ] = useState("");
  const [acct, setAcct] = useState("both");                 // both | personal | work
  const [tierOff, setTierOff] = useState({});               // tier key -> hidden
  const [showHandled, setShowHandled] = useState(false);

  const acctOk = (e) => acct === "both" || e.account === acct;
  const filt = (list) => list.filter((e) => acctOk(e) && matches(e, q));

  const visibleCount = useMemo(
    () => tiers.reduce((n, t) => (tierOff[t.key] ? n : n + filt(byTier[t.key]).length), 0),
    [tiers, byTier, tierOff, q, acct]
  );

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

  const Mail = ({ e, handledRow }) => (
    <div className={"mail " + (e.triage_tier || "review")} key={e.id}>
      <div className="mt">
        <span className={"tag " + e.account}>{e.account === "work" ? "Work" : "Personal"}</span>
        <span className="snd">{e.sender}</span><span className="addr">{e.sender_addr}</span>
        {handledRow && <span className="hstate">{e.handled_state}</span>}
        <span className="tmm">{rel(e.received_at)}</span>
      </div>
      <div className="subj">{e.subject}</div>
      {!handledRow && <div className="why">{e.why}</div>}
      {!handledRow && e.action && <div className="nx"><b>Next:</b> {e.action}</div>}
      <div className="mailacts">
        {busy[e.id]
          ? <span className="mwait">{busy[e.id]}…</span>
          : handledRow
            ? <button className="mbtn" onClick={() => act(e.id, e.account, "restore")}>↩ Restore</button>
            : <>
                <button className="mbtn" onClick={() => act(e.id, e.account, "archive")}>Archive</button>
                <button className="mbtn" onClick={() => act(e.id, e.account, "done")}>Done</button>
                <button className="mbtn danger" onClick={() => act(e.id, e.account, "spam")}>Spam</button>
              </>}
      </div>
    </div>
  );

  const handledFiltered = filt(handled);

  return (
    <div className="card full" style={{ marginTop: 18 }}>
      <div className="sec-h">Unified Inbox · personal + work<span className="grow" />
        <span style={{ color: "var(--muted)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
          {showHandled ? `${handledFiltered.length} handled` : `${visibleCount} shown`}
        </span>
      </div>

      <div className="filterbar">
        <input className="searchinp" placeholder="Search sender, subject, body…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="fseg">
          {["both", "personal", "work"].map((a) => (
            <button key={a} className={"fsegb" + (acct === a ? " on" : "")} onClick={() => setAcct(a)}>{a === "both" ? "All" : a === "work" ? "Work" : "Personal"}</button>
          ))}
        </div>
        <div className="fchips">
          {tiers.map((t) => (
            <button key={t.key} className={"fchip " + t.key + (tierOff[t.key] ? " off" : "")} onClick={() => setTierOff((o) => ({ ...o, [t.key]: !o[t.key] }))} title={t.label}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <button className={"fchip handled" + (showHandled ? " on" : "")} onClick={() => setShowHandled((v) => !v)}>
          {showHandled ? "← Inbox" : "Show handled"}
        </button>
      </div>

      {showHandled ? (
        <div>
          {handledFiltered.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 2px" }}>Nothing handled matches.</div>}
          {handledFiltered.map((e) => <Mail e={e} handledRow key={e.id} />)}
        </div>
      ) : (
        <>
          {risky.length > 0 && (
            <div className="alarm">
              <h3>⚠ Possible phishing / fraud — verify before clicking</h3>
              {risky.map((e) => <div className="it" key={e.id}><b>{e.sender}</b> &lt;{e.sender_addr}&gt; — {e.subject}{e.risk_why ? " · " + e.risk_why : ""}</div>)}
            </div>
          )}
          {visibleCount === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 2px" }}>No emails match your filters.</div>}
          {tiers.map((t) => {
            if (tierOff[t.key]) return null;
            const list = filt(byTier[t.key]); if (!list.length) return null;
            const show = t.key === "noise" && !expandNoise && !q ? list.slice(0, 4) : list;
            return (
              <div key={t.key}>
                <div className="tier-h"><span>{t.emoji}</span><span className="n">{t.label}</span><span className="c">{list.length}</span><span className="rl" /></div>
                {show.map((e) => <Mail e={e} key={e.id} />)}
                {t.key === "noise" && !q && list.length > 4 && (
                  <button className="morebtn" onClick={() => setExpandNoise((v) => !v)}>
                    {expandNoise ? "Show less" : `+${list.length - 4} more`}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
