"use client";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";
import Widget from "./Widget";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const when = (ts) => { const d = new Date(ts); return isNaN(d) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric" }); };

/** Co-parent inbox: one bucket per kid; only what dad needs to know surfaces. */
export default function KidsWidget() {
  const { toast } = useToast();
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/kids").then((r) => r.json()).then(setB).catch(() => setB({ connected: false, kids: [] }));
  useEffect(() => { load(); }, []);

  const drop = (x, id) => ({ ...x, toReview: Math.max(0, (x.toReview || 1) - 1), kids: x.kids.map((k) => ({ ...k, items: k.items.filter((i) => i.id !== id) })) });
  function gotIt(id) {
    setB((x) => drop(x, id));
    fetch("/api/kids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seen", id }) });
    toast("Got it ✓");
  }
  function clearAll(kid) {
    setB((x) => ({ ...x, kids: x.kids.map((k) => (!kid || k.name === kid ? { ...k, items: [] } : k)) }));
    fetch("/api/kids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seenAll", kid: kid || undefined }) })
      .then((r) => r.json()).then((j) => { if (j.ok) setB(j); });   // server state corrects counts (incl. shared "All" items)
    toast(kid ? `Cleared ${kid}'s bucket` : "All cleared");
  }
  async function addCal(id) {
    toast("Reading the email for a date…");
    try {
      const j = await fetch("/api/kids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "calendar", id }) }).then((r) => r.json());
      if (j.ok) { setB((x) => drop(x, id)); toast(`📅 ${j.summary} — ${j.allDay ? j.start.slice(0, 10) : new Date(j.start).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ✓`); }
      else toast({ message: j.error || "Couldn't create the event", tone: "error" });
    } catch (e) { toast({ message: "Failed: " + e.message, tone: "error" }); }
  }
  async function refresh() {
    setBusy(true);
    try { const j = await fetch("/api/kids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) }).then((r) => r.json()); if (j.ok) setB(j); }
    finally { setBusy(false); }
  }

  if (b === null) return null;

  const preview = !b.connected
    ? <span className="wmuted">Connect kmriedel0214@gmail.com →</span>
    : b.toReview > 0
      ? <span className="kw-prev">{b.kids.filter((k) => k.items.length).map((k) => `${k.name} ${k.items.length}`).join(" · ")}</span>
      : <span className="wmuted">All caught up — {b.noise} routine emails filtered out.</span>;

  return (
    <Widget wkey="kids" icon="family_restroom" accent="gold" title="Kids" count={b.connected ? b.toReview : null} countTone={b.toReview > 0 ? "gold" : ""} preview={preview}>
      {!b.connected ? (
        <div className="wmuted">This rolls the co-parent inbox you share for the kids into the Command Center. <a href="/connect">Connect kmriedel0214@gmail.com →</a></div>
      ) : (
        <>
          {b.kids.map((k) => (
            <div className="kidbucket" key={k.name}>
              <div className="kid-h"><span className="kid-name">{k.name}</span><span className="kid-count">{k.items.length ? k.items.length + " to review" : "clear"}</span>
                {k.items.length > 1 && <button className="kid-clearbtn" onClick={() => clearAll(k.name)}>clear all</button>}
              </div>
              {k.items.length === 0 && <div className="wmuted kid-clear">Nothing needs you.</div>}
              {k.items.map((e) => (
                <div className="kid-item" key={k.name + e.id}>
                  <div className="kid-body">
                    <div className="kid-subj">{e.subject}</div>
                    {e.why && <div className="kid-why">→ {e.why}{e.action ? " · " + e.action : ""}</div>}
                    <div className="kid-meta">{e.sender} · {when(e.received_at)}{e.kid === "All" ? " · all kids" : ""}</div>
                  </div>
                  <button className="iconbtn" title="Add to Google Calendar" onClick={() => addCal(e.id)}><M i="event" /></button>
                  <button className="iconbtn" title="Got it — dismiss" onClick={() => gotIt(e.id)}><M i="check_circle" /></button>
                </div>
              ))}
            </div>
          ))}
          <div className="kid-foot">
            <span className="wmuted">{b.noise} routine emails filtered out</span>
            <span className="grow" />
            {b.toReview > 1 && <button className="mbtn" onClick={() => clearAll(null)}><M i="clear_all" /> Dismiss all</button>}
            <button className="mbtn" onClick={refresh} disabled={busy}>{busy ? "…" : <><M i="refresh" /> Check now</>}</button>
          </div>
        </>
      )}
    </Widget>
  );
}
