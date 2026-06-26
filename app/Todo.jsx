"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { tagsOf, tagClass } from "@/lib/tags";
import EventComposer from "./EventComposer";
import { useTabs } from "./Tabs";
import { useToast } from "./Toast";

const dotFor = (t) => tagClass(t) === "personal" ? "#7E9A86" : tagClass(t) === "work" ? "#C2851E" : tagClass(t) === "project" ? "#6b5a8e" : "#b5ae9f";

// Fixed-position the tag dropdown from the button's rect so it escapes the
// group's overflow:hidden — right-aligned, flips up when near the viewport bottom.
function tagMenuStyle(a) {
  if (!a || typeof window === "undefined") return {};
  const style = { right: Math.max(8, window.innerWidth - a.right) };
  if (a.bottom + 270 > window.innerHeight && a.top > 270) style.bottom = window.innerHeight - a.top + 4;
  else style.top = a.bottom + 4;
  return style;
}

export default function Todo({ order, groups, openTotal }) {
  const router = useRouter();
  const { toast } = useToast();
  const { setTab } = useTabs();
  function askAboutTag(t) {
    try { sessionStorage.setItem("assistantPrefill", `Summarize my ${t} tasks and suggest what I should tackle first.`); } catch {}
    setTab("assistant");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const [busy, setBusy] = useState({});
  const [adding, setAdding] = useState({});   // tag -> text
  const [retag, setRetag] = useState({});      // taskId -> text
  const [evtFor, setEvtFor] = useState(null);  // taskId with open composer
  const [organized, setOrganized] = useState({}); // grocery tag -> sections | null
  const [organizing, setOrganizing] = useState({});
  const [editing, setEditing] = useState({});      // taskId -> draft text
  const startEdit = (it) => setEditing((e) => ({ ...e, [it.id]: it.text }));
  const cancelEdit = (id) => setEditing((e) => { const n = { ...e }; delete n[id]; return n; });
  async function saveEdit(it) {
    const text = (editing[it.id] || "").trim();
    cancelEdit(it.id);
    if (!text || text === it.text) return;
    await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", id: it.id, text }) });
    toast("Task updated"); router.refresh();
  }
  const isGrocery = (t) => /shopping|grocery/i.test(t);
  async function organize(t, items) {
    setOrganizing((o) => ({ ...o, [t]: true }));
    try {
      const j = await fetch("/api/organize-shopping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: items.map((i) => i.text) }) }).then((r) => r.json());
      if (j.ok && (j.sections || []).length) setOrganized((o) => ({ ...o, [t]: j.sections }));
      else toast(j.error || "Nothing to organize");
    } catch (e) { toast({ message: "Failed: " + e.message, tone: "error" }); } finally { setOrganizing((o) => ({ ...o, [t]: false })); }
  }
  const [dueFor, setDueFor] = useState(null);  // taskId with open date picker
  const [tagMenu, setTagMenu] = useState(null); // taskId with open tag dropdown
  const [tagAnchor, setTagAnchor] = useState(null); // button rect, for fixed positioning
  const [collapsed, setCollapsed] = useState({}); // tag -> collapsed

  useEffect(() => { try { setCollapsed(JSON.parse(localStorage.getItem("cc_todo_collapsed") || "{}")); } catch {} }, []);
  const persist = (next) => { setCollapsed(next); localStorage.setItem("cc_todo_collapsed", JSON.stringify(next)); };
  const toggleGroup = (t) => persist({ ...collapsed, [t]: !collapsed[t] });
  const setAll = (val) => persist(Object.fromEntries(order.map((t) => [t, val])));

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
    setBusy((b) => ({ ...b, [id]: true }));          // marks checkbox + triggers strike/collapse
    await new Promise((r) => setTimeout(r, 280));    // let the animation play
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
    setTagMenu(null);
    await post({ action: "retag", id: it.id, tags: merged });
  }
  async function addExistingTag(it, tag) {
    setTagMenu(null);
    const merged = Array.from(new Set([...tagsOf(it.tags), tag])).join("; ");
    await post({ action: "retag", id: it.id, tags: merged });
  }
  async function removeTag(it, tag) {
    const tags = tagsOf(it.tags).filter((t) => t.toLowerCase() !== tag.toLowerCase()).join("; ");
    await post({ action: "retag", id: it.id, tags });
  }
  // existing tags across all groups, minus the ones already on this entry
  const availableTags = (it) => order.filter((t) => t !== "Untagged" && !tagsOf(it.tags).some((x) => x.toLowerCase() === t.toLowerCase()));

  return (
    <div className="card">
      <div className="sec-h">To-Do · by tag <span className="grow" />
        <button className="miniact" onClick={() => setAll(false)}>Expand all</button>
        <button className="miniact" onClick={() => setAll(true)}>Collapse all</button>
        <span style={{ color: "var(--acc-deep)", fontWeight: 700, marginLeft: 8 }}>{openTotal} open</span>
      </div>
      {order.map((t) => {
        const list = groups[t];
        const isOpen = !collapsed[t];
        return (
          <div className={"cat" + (isOpen ? "" : " collapsed")} key={t}>
            <div className="cat-h" role="button" onClick={() => toggleGroup(t)}>
              <span className={"catcaret" + (isOpen ? " open" : "")}>▸</span>
              <span className="dot" style={{ background: dotFor(t) }} /><span className="nm">{t}</span><span className="c">{list.length}</span>
              <span className="grow" />
              {isGrocery(t) && <button className="orgbtn" title="Group by store section" onClick={(e) => { e.stopPropagation(); organized[t] ? setOrganized((o) => ({ ...o, [t]: null })) : organize(t, list); }}>{organizing[t] ? "…" : organized[t] ? "Reset" : "Organize"}</button>}
              <button className="askai" title={"Ask AI about " + t} onClick={(e) => { e.stopPropagation(); askAboutTag(t); }}><span className="material-symbols-outlined">smart_toy</span></button>
            </div>
            {isOpen && organized[t] && (
              <div className="grocgroups">
                {organized[t].map((sec, si) => (
                  <div className="grocsec" key={si}>
                    <div className="grocsec-h">{sec.name}<span className="grocsec-c">{sec.items.length}</span></div>
                    {sec.items.map((x, xi) => <div className="grocitem" key={xi}>○ {x}</div>)}
                  </div>
                ))}
              </div>
            )}
            {isOpen && !organized[t] && <>
            {list.map((it) => (
              <div key={it.id}>
                <div className={"task" + (busy[it.id] ? " done" : "")}>
                  <span className={"cbx" + (busy[it.id] ? " on" : "")} role="button" onClick={() => check(it.id)} title="Mark done" />
                  {editing[it.id] !== undefined ? (
                    <span className="editwrap">
                      <input className="editinp" autoFocus value={editing[it.id]}
                        onChange={(e) => setEditing((s) => ({ ...s, [it.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(it); if (e.key === "Escape") cancelEdit(it.id); }} />
                      <button type="button" className="editok" title="Save (Enter)" onClick={() => saveEdit(it)}><span className="material-symbols-outlined">check</span></button>
                      <button type="button" className="editcancel" title="Cancel (Esc)" onClick={() => cancelEdit(it.id)}><span className="material-symbols-outlined">close</span></button>
                    </span>
                  ) : (
                    <span className="tl editable" title="Click to edit" onClick={() => startEdit(it)}>{it.text}{it.synced === 0 && <em className="sync"> · syncing</em>}</span>
                  )}
                  <span className="tagrow">
                    {tagsOf(it.tags).map((x) => (
                      <span className={"tagchip " + tagClass(x)} key={x}>{x}
                        <button className="chipx" title={"Remove " + x} onClick={() => removeTag(it, x)}>×</button>
                      </span>
                    ))}
                    <span className="tagmenuwrap">
                      <button className="addtag" onClick={(e) => { const opening = tagMenu !== it.id; setTagAnchor(opening ? e.currentTarget.getBoundingClientRect() : null); setTagMenu(opening ? it.id : null); }}>+ tag ▾</button>
                      {tagMenu === it.id && (
                        <span className="tagmenu" style={tagMenuStyle(tagAnchor)}>
                          {availableTags(it).map((t) => (
                            <button key={t} className="tagmenu-opt" onClick={() => addExistingTag(it, t)}>
                              <span className="dot" style={{ background: dotFor(t) }} /> {t}
                            </button>
                          ))}
                          {availableTags(it).length === 0 && <span className="tagmenu-empty">No other tags yet</span>}
                          <div className="tagmenu-new">
                            <input className="addinp" placeholder="New tag…" value={retag[it.id] || ""}
                              onChange={(e) => setRetag((r) => ({ ...r, [it.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") applyTag(it); if (e.key === "Escape") setTagMenu(null); }} />
                            <button className="addbtn" onClick={() => applyTag(it)}>＋</button>
                          </div>
                        </span>
                      )}
                    </span>
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
            </>}
          </div>
        );
      })}
    </div>
  );
}
