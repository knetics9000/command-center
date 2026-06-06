"use client";
import { useTabs } from "./Tabs";
const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const cmdk = () => window.dispatchEvent(new Event("cc:cmdk"));

export default function TopUtility({ actCount = 0, pic, email }) {
  const { setTab } = useTabs();
  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <div className="tutil">
      <button className="tsearch" onClick={cmdk}>
        <M i="search" />
        <span className="tsearch-ph">Search or quick-add…</span>
        <span className="tsearch-kbd">⌘K</span>
      </button>
      <div className="tutil-right">
        <button className="ticon" onClick={() => go("inbox")} title={actCount + " need action"}>
          <M i="notifications" />{actCount > 0 && <span className="tbadge" />}
        </button>
        <button className="ticon" onClick={() => go("assistant")} title="Ask the assistant"><M i="smart_toy" /></button>
        <div className="tdivide" />
        <div className="tb-account">
          {pic ? <img className="tb-av" src={pic} alt="" referrerPolicy="no-referrer" /> : <span className="tb-av ph">KW</span>}
          <div className="tb-acwrap"><div className="tb-acname">Kurt</div><div className="tb-acmail">{email || ""}</div></div>
        </div>
      </div>
    </div>
  );
}
