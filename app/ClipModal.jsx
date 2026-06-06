"use client";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

export default function ClipModal({ email, tags = [], onClose }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [due, setDue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/clip-suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: email.subject, snippet: email.snippet, sender: email.sender }) })
      .then((r) => r.json()).then((j) => { setTitle((j.ok && j.title) || email.subject || ""); if (j.ok && j.tag) setTag(j.tag); })
      .catch(() => setTitle(email.subject || "")).finally(() => setLoading(false));
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, []);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const j = await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", text: title.trim(), tag }) }).then((r) => r.json());
      if (j.ok && due && j.id) await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setdue", id: j.id, due }) });
      toast("Task created ✓"); onClose(true);
    } catch (e) { toast({ message: "Failed: " + e.message, tone: "error" }); } finally { setSaving(false); }
  }

  return (
    <div className="clipov" onClick={() => onClose()}>
      <div className="clipmodal" onClick={(e) => e.stopPropagation()}>
        <div className="clip-h"><M i="content_cut" /> Clip to a task</div>
        <div className="clip-ctx">{email.sender} · {email.subject}</div>
        <label className="clip-l">Task</label>
        <input className="clip-inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={loading ? "Suggesting…" : "Task title"} autoFocus />
        <div className="clip-row">
          <div className="clip-col"><label className="clip-l">Tag</label>
            <input className="clip-inp" list="cliptags" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="optional" />
            <datalist id="cliptags">{tags.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="clip-col"><label className="clip-l">Due</label><input className="clip-inp" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div className="clip-acts"><button className="clbtn" onClick={save} disabled={saving || !title.trim()}>{saving ? "Adding…" : "Add task"}</button><button className="mbtn" onClick={() => onClose()}>Cancel</button></div>
      </div>
    </div>
  );
}
