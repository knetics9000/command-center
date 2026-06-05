"use client";
const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const cmdk = () => window.dispatchEvent(new Event("cc:cmdk"));
const goInbox = () => { const el = document.getElementById("sec-inbox"); if (el) el.scrollIntoView({ behavior: "smooth" }); };

export default function TopUtility({ actCount = 0, pic, email }) {
  return (
    <div className="tutil">
      <button className="tsearch" onClick={cmdk}>
        <M i="search" />
        <span className="tsearch-ph">Search or quick-add…</span>
        <span className="tsearch-kbd">⌘K</span>
      </button>
      <div className="tutil-right">
        <button className="ticon" onClick={goInbox} title={actCount + " need action"}>
          <M i="notifications" />{actCount > 0 && <span className="tbadge" />}
        </button>
        <button className="ticon" onClick={cmdk} title="Quick add"><M i="chat_bubble" /></button>
        <div className="tdivide" />
        <div className="tb-account">
          {pic ? <img className="tb-av" src={pic} alt="" referrerPolicy="no-referrer" /> : <span className="tb-av ph">KW</span>}
          <div className="tb-acwrap"><div className="tb-acname">Kurt</div><div className="tb-acmail">{email || ""}</div></div>
        </div>
      </div>
    </div>
  );
}
