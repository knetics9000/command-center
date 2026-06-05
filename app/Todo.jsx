"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { tagsOf, tagClass } from "@/lib/tags";
import EventComposer from "./EventComposer";
import { useToast } from "./Toast";

const dotFor = (t) => tagClass(t) === "personal" ? "#7E9A86" : tagClass(t) === "work" ? "#C2851E" : tagClass(t) === "project" ? "#6b5a8e" : "#b5ae9f";

export default function Todo({ order, groups, openTotal }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState({});
  const [adding, setAdding] = useState({});   // tag -> text
  const [retag, setRetag] = useState({});      // taskId -> text
  const [evtFor, setEvtFor] = useState(null);  // taskId with open composer
  const [dueFor, setDueFor] = useState(null);  // taskId with open date picker

  async function setDue(id, due) {
    setDueFor(null);
    await post({ action: "setdue", id, due });
  }
  const dueMeta = (due) => {
    if (!due) return null;
    const d = new Date(due + "T12:00:00"); const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = d < today;
    return { label: d.toLocaleDateString([], { month: "short", day: "numeric" }), overdue };
  };

  async function post(body) {
    const r = await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); toast({ message: "Task action failed: " + (j.error || r.status), tone: "error" }); }
    router.refresh();
  }
  async function check(id) {
    setBusy((b) => ({ ...b, [id]: true }));
    try { await post({ action: "check", id }); } finally { setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
  }
  async function add(tag) {
    const text = (adding[tag] || "").trim(); if (!text) return;
    setAdding((a) => ({ ...a, [tag]: "" }));
    await post({ action: "add", text, tag: tag === "Untagged" ? "" : tag });
  }
  async function applyTag(it) {
    const extra = (retag[it.id] || "").trim(); if (!extra) return;
    const merged = Array.from(new Set([...tagsOf(it.tags), extra])).join("; ");
    setRetag((r) => { const n = { ...r }; delete n[it.id]; return n; });
    await post({ action: "retag", id: it.id, tags: merged });
  }

  return (
    <div className="card">
      <div className="sec-h">To-Do · by tag <span className="grow" /><span style={{ color: "var(--acc-deep)", fontWeight: 700 }}>{openTotal} open</span></div>
      {order.map((t) => {
        const list = groups[t];
        return (
          <div className="cat" key={t}>
            <div className="cat-h"><span className="dot" style={{ background: dotFor(t) }} /><span className="nm">{t}</span><span className="c">{list.length}</span></div>
            {list.map((it) => (
              <div key={it.id}>
                <div className="task">
                  <span className={"cbx" + (busy[it.id] ? " on" : "")} role="button" onClick={() => check(it.id)} title="Mark done" />
                  <span className="tl">{it.text}{it.synced === 0 && <em className="sync"> · syncing</em>}</span>
                  <span className="tagrow">
                    {tagsOf(it.tags).map((x) => <span className={"tagchip " + tagClass(x)} key={x}>{x}</span>)}
                    {retag[it.id] === undefined
                      ? <button className="addtag" onClick={() => setRetag((r) => ({ ...r, [it.id]: "" }))}>+tag</button>
                      : <input className="taginp" autoFocus value={retag[it.id]} placeholder="tag…"
                          onChange={(e) => setRetag((r) => ({ ...r, [it.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") applyTag(it); if (e.key === "Escape") setRetag((r) => { const n = { ...r }; delete n[it.id]; return n; }); }}
                          onBlur={() => applyTag(it)} />}
                    {it.due && (() => { const m = dueMeta(it.due); return <span className={"duechip" + (m.overdue ? " overdue" : "")} onClick={() => setDueFor((id) => id === it.id ? null : it.id)}>⏰ {m.label}</span>; })()}
                    {!it.due && <button className="addtag" title="Set due date" onClick={() => setDueFor((id) => id === it.id ? null : it.id)}>⏰ due</button>}
                    {dueFor === it.id && (
                      <input type="date" className="dueinp" autoFocus defaultValue={it.due || ""}
                        onChange={(e) => setDue(it.id, e.target.value)} onBlur={() => setDueFor(null)} />
                    )}
                    <button className="addtag" title="Add to calendar" onClick={() => setEvtFor((id) => id === it.id ? null : it.id)}>📅</button>
                  </span>
                </div>
                {evtFor === it.id && (
                  <EventComposer key={it.id} summary={it.text} onClose={() => setEvtFor(null)} />
                )}
              </div>
            ))}
            <div className="addrow">
              <input className="addinp" placeholder={`Add to ${t}…`} value={adding[t] || ""}
                onChange={(e) => setAdding((a) => ({ ...a, [t]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") add(t); }} />
              <button className="addbtn" onClick={() => add(t)}>＋</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
