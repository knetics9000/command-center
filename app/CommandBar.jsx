"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Parse "+tag" / "#tag" tokens out of the text; the rest is the task body.
function parse(input) {
  const tags = [];
  const text = input.replace(/[+#]([\w-]+)/g, (_, t) => { tags.push(t); return ""; }).replace(/\s+/g, " ").trim();
  return { text, tags: tags.join("; ") };
}

export default function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); else setVal(""); }, [open]);

  async function submit() {
    const { text, tags } = parse(val); if (!text || busy) return;
    setBusy(true);
    try {
      await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", text, tag: tags }) });
      setOpen(false); router.refresh();
    } finally { setBusy(false); }
  }

  if (!open) return null;
  const preview = parse(val);
  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="cmdk">
        <div className="cmdk-row">
          <span className="cmdk-icon">⌘</span>
          <input ref={inputRef} className="cmdk-input" placeholder="Quick add a task…  use +tag to tag it"
            value={val} disabled={busy}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          <button className="cmdk-go" onClick={submit} disabled={busy}>{busy ? "…" : "Add ⏎"}</button>
        </div>
        <div className="cmdk-foot">
          {preview.text
            ? <span>Add <b>“{preview.text}”</b>{preview.tags ? <> · tags: <b>{preview.tags}</b></> : ""}</span>
            : <span>Type a task, then Enter. Tip: <code>Buy cleats +personal +urgent</code></span>}
          <span className="cmdk-esc">Esc to close</span>
        </div>
      </div>
    </div>
  );
}
