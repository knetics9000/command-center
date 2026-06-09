"use client";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
// Pull a clean app label out of a package name (com.google.android.gm → Gm).
const appLabel = (a) => {
  if (!a) return "Phone";
  const last = a.split(".").pop();
  return last.charAt(0).toUpperCase() + last.slice(1);
};

export default function NotifyWidget() {
  const { toast } = useToast();
  const [items, setItems] = useState(null);
  const [openId, setOpenId] = useState(null);   // expanded notification

  const load = () => fetch("/api/notifications").then((r) => r.json()).then((j) => setItems(j.ok ? j.notifications : [])).catch(() => setItems([]));
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  async function act(id, action, hours) {
    setItems((x) => x.filter((n) => n.id !== id)); // optimistic
    try {
      await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, hours }) });
      if (action === "task") toast("Sent to Right Now ✓");
      else if (action === "snooze") toast("Snoozed");
    } catch { toast({ message: "Failed", tone: "error" }); load(); }
  }

  if (items === null) return null;            // first load — stay quiet
  if (items.length === 0) return null;        // nothing to triage — don't take up space

  return (
    <div className="card notifcard" style={{ marginTop: 18 }}>
      <div className="sec-h"><M i="notifications_active" /> Phone notifications<span className="grow" /><span className="notif-count">{items.length}</span></div>
      <div className="notif-list">
        {items.map((n) => (
          <div className={"notif-row" + (openId === n.id ? " open" : "")} key={n.id}>
            <span className="notif-app">{appLabel(n.app)}</span>
            <div className="notif-body" onClick={() => setOpenId(openId === n.id ? null : n.id)} title="Tap to expand">
              {n.title && <div className="notif-title">{n.title}</div>}
              {n.body && <div className={"notif-text" + (openId === n.id ? " open" : "")}>{n.body}</div>}
              {openId === n.id && (
                <div className="notif-detail">
                  {n.link && <a href={n.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{n.link}</a>}
                  <span className="notif-when">{n.app}{n.posted_at ? " · " + new Date(n.posted_at).toLocaleString() : ""}</span>
                </div>
              )}
            </div>
            <div className="notif-acts">
              <button className="iconbtn" title="Make it a task" onClick={() => act(n.id, "task")}><M i="add_task" /></button>
              <button className="iconbtn" title="Snooze 3h" onClick={() => act(n.id, "snooze", 3)}><M i="snooze" /></button>
              <button className="iconbtn" title="Dismiss" onClick={() => act(n.id, "dismiss")}><M i="close" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
