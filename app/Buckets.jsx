"use client";
import { useState, useEffect } from "react";
import RelatedDrawer from "./RelatedDrawer";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

function CategorySummary({ name }) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    let live = true;
    setSummary(null);
    fetch("/api/category-summary?name=" + encodeURIComponent(name)).then((r) => r.json())
      .then((j) => { if (live) setSummary(j.ok ? j.summary : "Couldn't summarize."); }).catch(() => live && setSummary("Couldn't summarize."));
    return () => { live = false; };
  }, [name]);
  return (
    <div className="catsum">
      <div className="catsum-h"><M i="auto_awesome" /> What's happening in {name}</div>
      <div className="catsum-b">{summary === null ? "Summarizing…" : summary}</div>
    </div>
  );
}

export default function Buckets({ buckets = [] }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="sec-h"><span className="star"><M i="category" /></span> Life Categories<span className="grow" /><span className="monthlbl">auto-collected from your mail & tasks</span></div>
      <div className="bktgrid">
        {buckets.map((b) => (
          <div className="bktwrap" key={b.name}>
            <div className={"bkt" + (open === b.name ? " on" : "")} style={{ "--c": b.color }} onClick={() => setOpen((o) => (o === b.name ? null : b.name))}>
              <span className="bkt-dot" />
              <div className="bkt-info"><div className="bkt-name">{b.name}</div><div className="bkt-meta">{b.emails} emails · {b.tasks} tasks</div></div>
              <span className={"priocaret" + (open === b.name ? " open" : "")}>▸</span>
            </div>
            {open === b.name && <><CategorySummary name={b.name} /><RelatedDrawer title={b.name} /></>}
          </div>
        ))}
      </div>
    </div>
  );
}
