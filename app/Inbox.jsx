"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import EventComposer from "./EventComposer";

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
  const [bodies, setBodies] = useState({});                 // id -> 'loading' | text | {error}
  const [reply, setReply] = useState({});                   // id -> {text, gen, saving, saved}
  const [evt, setEvt] = useState({});                       // id -> {loading, summary, location, start, durationMin}

  async function addEvent(e) {
    if (evt[e.id]) { setEvt((x) => { const n = { ...x }; delete n[e.id]; return n; }); return; }
    setEvt((x) => ({ ...x, [e.id]: { loading: true } }));
    try {
      const r = await fetch("/api/inbox/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, account: e.account }) });
      const j = await r.json();
      setEvt((x) => ({ ...x, [e.id]: j.ok ? { ...j, loading: false } : { loading: false, summary: e.subject } }));
    } catch { setEvt((x) => ({ ...x, [e.id]: { loading: false, summary: e.subject } })); }
  }

  async function genReply(e) {
    if (reply[e.id]) { setReply((r) => { const n = { ...r }; delete n[e.id]; return n; }); return; }
    setReply((r) => ({ ...r, [e.id]: { gen: true, text: "" } }));
    try {
      const res = await fetch("/api/inbox/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", id: e.id, account: e.account }) });
      const j = await res.json();
      setReply((r) => ({ ...r, [e.id]: { gen: false, text: j.ok ? j.text : "", error: j.ok ? null : (j.error || "failed") } }));
    } catch (err) { setReply((r) => ({ ...r, [e.id]: { gen: false, text: "", error: err.message } })); }
  }
  async function saveDraft(e) {
    const cur = reply[e.id]; if (!cur || !cur.text.trim()) return;
    setReply((r) => ({ ...r, [e.id]: { ...cur, saving: true } }));
    try {
      const res = await fetch("/api/inbox/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", id: e.id, account: e.account, text: cur.text }) });
      const j = await res.json();
      if (j.ok) setReply((r) => ({ ...r, [e.id]: { ...r[e.id], saving: false, saved: true } }));
      else { alert("Save failed: " + (j.error || "")); setReply((r) => ({ ...r, [e.id]: { ...r[e.id], saving: false } })); }
    } catch (err) { alert("Save failed: " + err.message); setReply((r) => ({ ...r, [e.id]: { ...r[e.id], saving: false } })); }
  }

  async function toggleBody(e) {
    if (bodies[e.id]) { setBodies((b) => { const n = { ...b }; delete n[e.id]; return n; }); return; }
    setBodies((b) => ({ ...b, [e.id]: "loading" }));
    try {
      const r = await fetch(`/api/inbox/body?account=${e.account}&id=${e.id}`);
      const j = await r.json();
      setBodies((b) => ({ ...b, [e.id]: j.ok ? (j.body || "(empty)") : "⚠ " + (j.error || "failed") }));
    } catch (err) { setBodies((b) => ({ ...b, [e.id]: "⚠ " + err.message })); }
  }

  const acctOk = (e) => acct === "both" || e.account === acct;
  const filt = (list) => list.filter((e) => acctOk(e) && matches(e, q));

  const visibleCount = useMemo(
    () => tiers.reduce((n, t) => (tierOff[t.key] ? n : n + filt(byTier[t.key]).length), 0),
    [tiers, byTier, tierOff, q, acct]
  );

  const [snoozeFor, setSnoozeFor] = useState(null);   // email id with open snooze menu

  function snoozeOptions() {
    const now = new Date();
    const at = (base, h, m = 0) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d; };
    const evening = at(now, 18); if (evening <= now) evening.setDate(evening.getDate() + 1);
    const tomorrow = at(now, 8); tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = at(now, 8); nextWeek.setDate(nextWeek.getDate() + ((8 - nextWeek.getDay()) % 7 || 7));
    return [
      { label: "In 3 hours", at: new Date(now.getTime() + 3 * 3600e3) },
      { label: "This evening", at: evening },
      { label: "Tomorrow 8am", at: tomorrow },
      { label: "Next week", at: nextWeek },
    ];
  }
  async function snooze(id, until) {
    setSnoozeFor(null);
    setBusy((b) => ({ ...b, [id]: "snooze" }));
    try {
      await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "snooze", id, until: until.toISOString() }) });
      router.refresh();
    } finally { setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
  }

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
      {bodies[e.id] && (
        <div className="mbody">{bodies[e.id] === "loading" ? <span className="bodyload">Loading…</span> : bodies[e.id]}</div>
      )}
      {reply[e.id] && (
        <div className="replybox">
          {reply[e.id].gen
            ? <span className="bodyload">Drafting a reply…</span>
            : reply[e.id].error
              ? <span style={{ color: "#b0432a", fontSize: 12.5 }}>⚠ {reply[e.id].error}</span>
              : <>
                  <textarea className="replyta" value={reply[e.id].text} disabled={reply[e.id].saved}
                    onChange={(ev) => setReply((r) => ({ ...r, [e.id]: { ...r[e.id], text: ev.target.value } }))} />
                  <div className="replyacts">
                    {reply[e.id].saved
                      ? <span className="savedtag">✓ Saved to Gmail drafts</span>
                      : <>
                          <button className="mbtn" onClick={() => saveDraft(e)} disabled={reply[e.id].saving}>{reply[e.id].saving ? "Saving…" : "Save to Gmail drafts"}</button>
                          <button className="mbtn" onClick={() => genReply(e)}>Discard</button>
                          <span className="replyhint">Saved as a draft — never auto-sent.</span>
                        </>}
                  </div>
                </>}
        </div>
      )}
      {evt[e.id] && (
        <EventComposer key={e.id} loading={evt[e.id].loading} summary={evt[e.id].summary} location={evt[e.id].location}
          start={evt[e.id].start} durationMin={evt[e.id].durationMin}
          onClose={() => setEvt((x) => { const n = { ...x }; delete n[e.id]; return n; })} />
      )}
      <div className="mailacts">
        {!handledRow && <button className="mbtn reply" onClick={() => genReply(e)}>{reply[e.id] ? "Close reply" : "✍ Reply"}</button>}
        {!handledRow && <button className="mbtn" onClick={() => addEvent(e)}>{evt[e.id] ? "Close" : "📅 Calendar"}</button>}
        {!handledRow && (
          <span className="snoozewrap">
            <button className="mbtn" onClick={() => setSnoozeFor((id) => id === e.id ? null : e.id)}>💤 Snooze</button>
            {snoozeFor === e.id && (
              <span className="snoozemenu">
                {snoozeOptions().map((o) => (
                  <button key={o.label} className="snoozeopt" onClick={() => snooze(e.id, o.at)}>
                    {o.label}<span className="st">{o.at.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </button>
                ))}
              </span>
            )}
          </span>
        )}
        <button className="mbtn read" onClick={() => toggleBody(e)}>{bodies[e.id] ? "Hide" : "Read"}</button>
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
