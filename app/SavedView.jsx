"use client";
import { useState, useEffect, useRef } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const KIND_ICON = { video: "smart_display", article: "article", social: "tag", pdf: "picture_as_pdf", podcast: "podcasts", link: "link", note: "sticky_note_2" };
const rel = (ts) => { if (!ts) return ""; const d = new Date(ts.replace(" ", "T") + "Z"); const m = Math.floor((Date.now() - d) / 60000); if (m < 60) return m + "m"; if (m < 1440) return Math.floor(m / 60) + "h"; return d.toLocaleDateString([], { month: "short", day: "numeric" }); };
function credTier(s) {
  if (s == null) return { label: "", cls: "c-na" };
  if (s >= 95) return { label: "Highly Trusted", cls: "c-95" };
  if (s >= 80) return { label: "Generally Reliable", cls: "c-80" };
  if (s >= 60) return { label: "Mixed Reliability", cls: "c-60" };
  if (s >= 40) return { label: "Questionable", cls: "c-40" };
  return { label: "Low Confidence", cls: "c-0" };
}

export default function SavedView({ projects = [] }) {
  const { toast } = useToast();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState({});
  const [filter, setFilter] = useState(null);
  const [busy, setBusy] = useState({});
  const [bm, setBm] = useState("");
  const bmRef = useRef(null);

  const load = () => fetch("/api/share").then((r) => r.json()).then((j) => setItems(j.ok ? j.items : [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const origin = window.location.origin;
    const code = `javascript:(function(){window.open('${origin}/share?title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href)+'&text='+encodeURIComponent((window.getSelection?window.getSelection().toString():'')||''),'_blank','noopener');})();`;
    setBm(code); if (bmRef.current) bmRef.current.setAttribute("href", code);
    try { const f = sessionStorage.getItem("savedFilter"); if (f) { setFilter(f); sessionStorage.removeItem("savedFilter"); } } catch {}
  }, []);

  async function act(id, body, optimistic) {
    if (optimistic) optimistic();
    setBusy((b) => ({ ...b, [id]: true }));
    try { const j = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) }).then((r) => r.json()); if (j.item) setItems((x) => x.map((i) => i.id === id ? j.item : i)); }
    finally { setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
  }
  const del = (id) => { setItems((x) => x.filter((i) => i.id !== id)); fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }); toast("Removed"); };
  function copyBm() { navigator.clipboard?.writeText(bm).then(() => toast("Bookmarklet copied")).catch(() => {}); }

  const cats = {};
  (items || []).forEach((it) => (it.categories || []).forEach((c) => (cats[c] = (cats[c] || 0) + 1)));
  const catList = Object.entries(cats).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  const shown = (items || []).filter((it) => !filter || (it.categories || []).includes(filter));

  return (
    <div className="card full">
      <div className="sec-h"><span className="star"><M i="bookmark" /></span> Saved — AI knowledge layer<span className="grow" />{items && <span className="cl-count">{items.length}</span>}</div>

      <details className="bmhelp">
        <summary>🖥️ Share from a desktop browser</summary>
        <div className="bmbody">
          <p><b>Drag</b> this to your bookmarks bar, then click it on any page to save it here:</p>
          <a ref={bmRef} className="bmlink" onClick={(e) => e.preventDefault()} draggable>📌 Save to Command Center</a>
          <p className="bmhint">Can't drag? New bookmark → paste this URL (<button className="linklike" onClick={copyBm}>copy</button>):</p>
          <code className="bmcode">{bm}</code>
        </div>
      </details>

      {catList.length > 0 && (
        <div className="catchips">
          <button className={"catchip" + (!filter ? " on" : "")} onClick={() => setFilter(null)}>All<span className="cc">{items.length}</span></button>
          {catList.map((c) => <button key={c.name} className={"catchip" + (filter === c.name ? " on" : "")} onClick={() => setFilter(filter === c.name ? null : c.name)}>{c.name}<span className="cc">{c.n}</span></button>)}
        </div>
      )}

      {items === null && <div className="chat-sk"><div className="sk b them" /><div className="sk b me" /></div>}
      {items && items.length === 0 && (
        <div className="emptyhero sm"><div className="ehicon">🔖</div><div className="ehtitle">Nothing saved yet</div><div className="ehsub">Share a link from YouTube/your browser → it gets analyzed and filed here.</div></div>
      )}

      {shown.map((it) => {
        const tier = credTier(it.credibility);
        const ex = open[it.id];
        return (
          <div className={"smedia" + (ex ? " ex" : "")} key={it.id}>
            <div className="smedia-row" onClick={() => setOpen((o) => ({ ...o, [it.id]: !o[it.id] }))}>
              <span className="sm-ic"><M i={KIND_ICON[it.kind] || "link"} /></span>
              {(it.categories || [])[0] && <span className="sm-cat">{it.categories[0]}</span>}
              {it.credibility != null && <span className={"sm-cred " + tier.cls} title={tier.label + " · " + (it.cred_reason || "")}>{it.credibility}</span>}
              <div className="sm-titles">
                <div className="sm-ai">{it.ai_title || it.title || "Untitled"}{it.analyzed === 0 && <em className="sm-pending"> · analyzing…</em>}</div>
                <div className="sm-orig">Original: {it.title}</div>
              </div>
              <span className="sm-time">{rel(it.created_at)}</span>
              {it.url && <a className="sm-open" href={it.url} target="_blank" rel="noreferrer" title="Open the saved video/site" onClick={(e) => e.stopPropagation()}><M i="open_in_new" /></a>}
              <span className={"priocaret" + (ex ? " open" : "")}>▸</span>
            </div>

            {ex && (
              <div className="smedia-detail">
                {it.summary && <p className="sm-summary">{it.summary}</p>}
                {(it.categories || []).length > 0 && <div className="sm-chiprow">{it.categories.map((c) => <span className="sm-tag" key={c}>{c}</span>)}</div>}
                {(it.takeaways || []).length > 0 && <div className="sm-sec"><div className="sm-h">Key takeaways</div><ul>{it.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
                {(it.insights || []).length > 0 && <div className="sm-sec"><div className="sm-h">Actionable insights</div><ul>{it.insights.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
                <div className="sm-grid">
                  {(it.tools || []).length > 0 && <div className="sm-sec"><div className="sm-h">Tools</div><div className="sm-pills">{it.tools.map((t, i) => <span className="sm-pill" key={i}>{t}</span>)}</div></div>}
                  {(it.people || []).length > 0 && <div className="sm-sec"><div className="sm-h">People</div><div className="sm-pills">{it.people.map((t, i) => <span className="sm-pill" key={i}>{t}</span>)}</div></div>}
                </div>
                {(it.projects || []).length > 0 && <div className="sm-sec"><div className="sm-h">Linked projects</div><div className="sm-pills">{it.projects.map((t, i) => <span className="sm-proj" key={i}>★ {t.replace(/\s*project\s*$/i, "")}</span>)}</div></div>}
                {it.cred_reason && <div className="sm-credline"><b>Credibility {it.credibility}/100</b> — {tier.label}. {it.cred_reason}</div>}
                <div className="sm-actions">
                  {it.url && <a className="mbtn" href={it.url} target="_blank" rel="noreferrer"><M i="open_in_new" /> Open</a>}
                  <button className="mbtn" disabled={busy[it.id]} onClick={() => act(it.id, { action: "reanalyze" })}>{busy[it.id] ? "…" : <><M i="autorenew" /> Re-analyze</>}</button>
                  {projects.length > 0 && (
                    <select className="sm-addproj" defaultValue="" onChange={(e) => { if (e.target.value) act(it.id, { action: "addproject", tag: e.target.value }); e.target.value = ""; }}>
                      <option value="" disabled>+ Add to project</option>
                      {projects.map((p) => <option key={p} value={p}>{p.replace(/\s*project\s*$/i, "")}</option>)}
                    </select>
                  )}
                  <button className="mbtn danger" onClick={() => del(it.id)}><M i="delete" /> Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
