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
        <div className="shareicon">{status === "saving" ? <M i="hourglass_top" /> : status === "saved" ? <M i="bookmark_added" /> : <M i="error" />}</div>
        <div className="sharemsg">
          {status === "saving" && "Saving to Command Center…"}
          {status === "saved" && "Saved to Command Center ✓"}
          {status === "error" && "Couldn't save that — try again."}
        </div>
        {item && (
          <div className="shareitem">
            <div className="shareitem-t">{item.title}</div>
            <div className="shareitem-m">
              {item.kind && <span className="sharekind">{item.kind}</span>}
              {item.category && <span className="sharecat">{item.category}</span>}
            </div>
            {item.url && <a className="shareurl" href={item.url} target="_blank" rel="noreferrer">{item.url}</a>}
          </div>
        )}
        <a className="sharehome" href="/">Open Command Center →</a>
      </div>
    </div>
  );
}
