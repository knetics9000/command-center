"use client";
import { useState, useEffect, useRef } from "react";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

export default function ShareLander({ title, text, url }) {
  const [status, setStatus] = useState("saving"); // saving | saved | error
  const [item, setItem] = useState(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return; fired.current = true;
    fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, text, url }) })
      .then((r) => r.json())
      .then((j) => { if (j.ok) { setItem(j.item); setStatus("saved"); } else setStatus("error"); })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="sharelander">
      <div className="sharecard">
        <div className="shareicon">{status === "saving" ? <M i="neurology" /> : status === "saved" ? <M i="bookmark_added" /> : <M i="error" />}</div>
        <div className="sharemsg">
          {status === "saving" && "Analyzing & saving…"}
          {status === "saved" && "Saved to Command Center ✓"}
          {status === "error" && "Couldn't save that — try again."}
        </div>
        {item && (
          <div className="shareitem">
            {item.credibility != null && <div className="sharecred">Credibility {item.credibility}/100</div>}
            <div className="shareitem-t">{item.ai_title || item.title}</div>
            {item.ai_title && item.title && item.ai_title !== item.title && <div className="shareitem-o">Original: {item.title}</div>}
            <div className="shareitem-m">{(item.categories || []).slice(0, 3).map((c) => <span className="sharecat" key={c}>{c}</span>)}</div>
            {item.summary && <div className="sharesum">{item.summary}</div>}
          </div>
        )}
        <a className="sharehome" href="/?tab=saved">Open Command Center →</a>
      </div>
    </div>
  );
}
