"use client";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const KIND_ICON = { video: "smart_display", article: "article", product: "shopping_bag", recipe: "restaurant", note: "sticky_note_2", link: "link" };
const rel = (ts) => { if (!ts) return ""; const d = new Date(ts.replace(" ", "T") + "Z"); const m = Math.floor((Date.now() - d) / 60000); if (m < 60) return m + "m ago"; if (m < 1440) return Math.floor(m / 60) + "h ago"; return d.toLocaleDateString([], { month: "short", day: "numeric" }); };

export default function SavedView() {
  const { toast } = useToast();
  const [items, setItems] = useState(null);
  const load = () => fetch("/api/share").then((r) => r.json()).then((j) => setItems(j.ok ? j.items : [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  async function del(id) {
    setItems((x) => x.filter((i) => i.id !== id));
    await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }).catch(() => {});
    toast("Removed");
  }

  return (
    <div className="card full">
      <div className="sec-h"><span className="star"><M i="bookmark" /></span> Saved — shared from other apps<span className="grow" />
        {items && <span className="cl-count">{items.length}</span>}
      </div>
      <p className="cl-intro">Anything you share to Command Center from another app (YouTube, browser, etc.) lands here, auto-categorized. Share from the app's share sheet → pick Command Center.</p>
      {items === null && <div className="chat-sk"><div className="sk b them" /><div className="sk b me" /></div>}
      {items && items.length === 0 && (
        <div className="emptyhero sm"><div className="ehicon">🔖</div><div className="ehtitle">Nothing saved yet</div><div className="ehsub">Open YouTube (or any app), tap Share, and choose Command Center.</div></div>
      )}
      {items && items.map((it) => (
        <div className="saveditem" key={it.id}>
          <span className="saved-ic"><M i={KIND_ICON[it.kind] || "link"} /></span>
          <div className="saved-body">
            <div className="saved-title">{it.url ? <a href={it.url} target="_blank" rel="noreferrer">{it.title}</a> : it.title}</div>
            <div className="saved-meta">
              {it.kind && <span className="saved-kind">{it.kind}</span>}
              {it.category && <span className="saved-cat">{it.category}</span>}
              <span className="saved-time">{rel(it.created_at)}</span>
            </div>
          </div>
          <button className="mbtn" title="Remove" onClick={() => del(it.id)}><M i="delete" /></button>
        </div>
      ))}
    </div>
  );
}
