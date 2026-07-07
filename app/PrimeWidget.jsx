"use client";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";
import Widget from "./Widget";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

/** Prime: the short list of to-dos you hand-pick (star) in the To-Do tab. */
export default function PrimeWidget() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState(null);

  const load = () => fetch("/api/prime").then((r) => r.json()).then((j) => setTasks(j.ok ? j.tasks : [])).catch(() => setTasks([]));
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  function act(id, body, msg) {
    setTasks((x) => x.filter((t) => t.id !== id)); // optimistic
    fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    if (msg) toast(msg);
  }

  if (tasks === null) return null;
  const preview = tasks.length === 0
    ? <span className="wmuted">No pinned tasks.</span>
    : <span className="wmuted">{tasks[0].text}</span>;

  return (
    <Widget wkey="prime" icon="star" accent="gold" title="Prime" count={tasks.length || null} countTone="gold" preview={preview} openTab="todo" openLabel="Open To-Do">
      {tasks.length === 0 ? (
        <div className="wmuted">Star a task in the To-Do tab to pin it here — your short list of what matters most.</div>
      ) : (
        <div className="prime-list">
          {tasks.map((t) => (
            <div className="prime-item" key={t.id}>
              <button className="now-done" title="Mark done" onClick={() => act(t.id, { action: "check" }, "Done ✓")}><M i="radio_button_unchecked" /></button>
              <div className="prime-body">
                <div className="prime-text">{t.text}</div>
                {(t.due || (t.tags || "").trim()) && <div className="prime-meta">{t.due ? "Due " + t.due : ""}{t.due && (t.tags || "").trim() ? " · " : ""}{(t.tags || "").split(";")[0].trim()}</div>}
              </div>
              <button className="taskstar on" title="Unpin from Prime" onClick={() => act(t.id, { action: "prime", prime: 0 }, "Unpinned")}><M i="star" /></button>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}
