"use client";
import { useState, useEffect } from "react";

// Reusable drill-down: fetches /api/related and renders linked records + AI context.
// Used by briefing priorities, the "since last briefing" delta, and themes.
function Block({ title, children }) {
  return <div className="relblock"><div className="relbh">{title}</div>{children}</div>;
}

export default function RelatedDrawer({ title, projectTag, excludeEmailId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true; setLoading(true);
    fetch("/api/related", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, projectTag, excludeEmailId, withAI: true }) })
      .then((r) => r.json()).then((j) => { if (on) { setData(j.ok ? j : {}); setLoading(false); } })
      .catch(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [title, projectTag, excludeEmailId]);

  if (loading) return <div className="reldrawer"><div className="chat-sk"><div className="sk b them" /><div className="sk b me" /><div className="sk b them" /></div></div>;
  if (!data) return null;
  const n = (a) => (a ? a.length : 0);
  const has = n(data.emails) + n(data.tasks) + n(data.projects) + n(data.contacts) + n(data.events);

  return (
    <div className="reldrawer">
      {data.ai && (data.ai.why || (data.ai.actions && data.ai.actions.length > 0)) && (
        <div className="relai">
          {data.ai.why && <div className="relwhy"><b>Why this surfaced:</b> {data.ai.why}</div>}
          {data.ai.actions && data.ai.actions.length > 0 && (
            <div className="relactions">{data.ai.actions.map((a, i) => <span className="relchip" key={i}>→ {a}</span>)}</div>
          )}
        </div>
      )}
      <div className="relgrid">
        {n(data.emails) > 0 && (
          <Block title={`Related emails · ${data.emails.length}`}>
            {data.emails.map((e) => <div className="relrow" key={e.id}><span className={"tag " + e.account}>{e.account === "work" ? "W" : "P"}</span><span className="relsnd">{e.sender}</span> {e.subject}</div>)}
          </Block>
        )}
        {n(data.contacts) > 0 && (
          <Block title="People">
            {data.contacts.map((c, i) => <div className="relrow" key={i}><span className="reldot" />{c.name}<span className="relmuted"> · {c.count}</span></div>)}
          </Block>
        )}
        {n(data.projects) > 0 && (
          <Block title="Projects">
            {data.projects.map((p, i) => <div className="relrow" key={i}>★ {p.name}</div>)}
          </Block>
        )}
        {n(data.tasks) > 0 && (
          <Block title="Tasks">
            {data.tasks.map((t) => <div className="relrow" key={t.id}>○ {t.text}</div>)}
          </Block>
        )}
        {n(data.events) > 0 && (
          <Block title="Calendar">
            {data.events.map((ev, i) => <div className="relrow" key={i}>◷ {ev.title}{ev.location ? " · " + ev.location : ""}</div>)}
          </Block>
        )}
      </div>
      {!has && <div className="relmuted" style={{ fontSize: 12.5, padding: "4px 2px" }}>No linked records found yet.</div>}
    </div>
  );
}
