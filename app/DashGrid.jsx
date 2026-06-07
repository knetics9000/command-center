"use client";
import { useState } from "react";
import { useTabs } from "./Tabs";
import Avatar from "./Avatar";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;

export default function DashGrid({ briefing, inboxTop = [], actCount = 0, projectsTop = [], projectsCount = 0, todoTop = [], todoOpen = 0, dueTop = [], cleanupCount = 0, prioTop = [], prioCount = 0, contacts = [], split = {}, cleared = {}, suggestedTasks = [], sharedCats = [], sharedTotal = 0, children }) {
  const { setTab } = useTabs();
  const [briefOpen, setBriefOpen] = useState(false);
  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <>
      <div className="wgrid">
        {/* Today's Briefing — expands inline */}
        <div className="widget wbrief">
          <div className="whead">
            <span className="wicon brief"><M i="auto_awesome" /></span>
            <span className="wtitle">Today's Briefing</span>
            <button className="wexpand" onClick={() => setBriefOpen((o) => !o)}>{briefOpen ? "Hide ▲" : "Open ▾"}</button>
          </div>
          <div className="wbody">
            <div className="wbrief-greet">{briefing ? briefing.greeting : "No briefing yet."}</div>
            {(briefing && briefing.priorities || []).slice(0, 3).map((p, i) => (
              <div className="wbrief-p" key={i}><span className="wpn">{i + 1}</span><span className="wbrief-pt">{p.title}</span></div>
            ))}
          </div>
        </div>

        {/* AI Cleanup organizer */}
        <div className="widget waccent wclick" onClick={() => go("cleanup")}>
          <div className="whead"><span className="wicon accent"><M i="auto_fix_high" /></span><span className="wtitle">AI Cleanup</span>{cleanupCount > 0 && <span className="wcount accent">{cleanupCount}</span>}</div>
          <div className="wbody"><div className="wmuted">{cleanupCount > 0 ? `${cleanupCount} suggestions to organize your tasks & spot new projects.` : "Tasks look organized. Open to re-scan."}</div></div>
          <div className="wfoot light">Open organizer <M i="arrow_forward" /></div>
        </div>

        {/* Priority Emails */}
        <div className="widget wclick" onClick={() => go("inbox")}>
          <div className="whead"><span className="wicon gold"><M i="star" /></span><span className="wtitle">Priority Emails</span><span className="wcount gold">{prioCount}</span></div>
          <div className="wbody">
            {prioTop.length === 0 && <div className="wmuted">No priority emails right now.</div>}
            {prioTop.map((e, i) => <div className="wrow" key={i}><b>{e.sender}</b> · {e.subject}</div>)}
          </div>
          <div className="wfoot">Open Priority <M i="arrow_forward" /></div>
        </div>

        {/* Needs Attention */}
        <div className="widget wclick" onClick={() => go("inbox")}>
          <div className="whead"><span className="wicon red"><M i="priority_high" /></span><span className="wtitle">Needs Attention</span><span className="wcount red">{actCount}</span></div>
          <div className="wbody">
            {inboxTop.length === 0 && <div className="wmuted">Inbox is clear 🌿</div>}
            {inboxTop.map((e, i) => <div className="wrow" key={i}><b>{e.sender}</b> · {e.subject}</div>)}
          </div>
          <div className="wfoot">Open Inbox <M i="arrow_forward" /></div>
        </div>

        {/* Active Projects */}
        <div className="widget wclick" onClick={() => go("projects")}>
          <div className="whead"><span className="wicon"><M i="account_tree" /></span><span className="wtitle">Active Projects</span><span className="wcount">{projectsCount}</span></div>
          <div className="wbody">
            {projectsTop.map((p, i) => <div className="wrow split" key={i}><span className="wrl">{p.name}</span><span className="wrr">{p.open} open · {p.pct}%</span></div>)}
          </div>
          <div className="wfoot">Open Projects <M i="arrow_forward" /></div>
        </div>

        {/* To-Do */}
        <div className="widget wclick" onClick={() => go("todo")}>
          <div className="whead"><span className="wicon"><M i="checklist" /></span><span className="wtitle">To-Do</span><span className="wcount">{todoOpen}</span></div>
          <div className="wbody">
            {todoTop.map((t, i) => <div className="wrow split" key={i}><span className="wrl">{t.tag}</span><span className="wrr">{t.count}</span></div>)}
          </div>
          <div className="wfoot">Open To-Do <M i="arrow_forward" /></div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="widget wclick" onClick={() => go("calendar")}>
          <div className="whead"><span className="wicon teal"><M i="event_upcoming" /></span><span className="wtitle">Upcoming</span></div>
          <div className="wbody">
            {dueTop.length === 0 && <div className="wmuted">Nothing on the horizon.</div>}
            {dueTop.map((d, i) => <div className="wrow split" key={i}><span className="wrl">{d.isTask ? "✓ " : ""}{d.summary}</span><span className="wrr">{d.when}</span></div>)}
          </div>
          <div className="wfoot">Open Calendar <M i="arrow_forward" /></div>
        </div>

        {/* AI-Suggested next actions */}
        <div className="widget wclick" onClick={() => go("todo")}>
          <div className="whead"><span className="wicon brief"><M i="lightbulb" /></span><span className="wtitle">AI-Suggested Tasks</span></div>
          <div className="wbody">
            {suggestedTasks.length === 0 && <div className="wmuted">No suggestions right now.</div>}
            {suggestedTasks.map((t, i) => <div className="wrow" key={i}>○ {t}</div>)}
          </div>
          <div className="wfoot">Open To-Do <M i="arrow_forward" /></div>
        </div>

        {/* Recently Updated Contacts */}
        <div className="widget wclick" onClick={() => go("inbox")}>
          <div className="whead"><span className="wicon"><M i="group" /></span><span className="wtitle">Recent Contacts</span></div>
          <div className="wbody wcontacts">
            {contacts.length === 0 && <div className="wmuted">No recent contacts.</div>}
            {contacts.map((c, i) => <div className="wcontact" key={i}><Avatar name={c.name} size={26} /><span className="wcname">{c.name}</span>{c.n > 1 && <span className="wcn">{c.n}</span>}</div>)}
          </div>
        </div>

        {/* Work / Personal Split */}
        <div className="widget">
          <div className="whead"><span className="wicon teal"><M i="balance" /></span><span className="wtitle">Work / Personal</span></div>
          <div className="wbody">
            {(() => {
              const ew = split.emailWork || 0, ep = split.emailPersonal || 0, te = ew + ep || 1;
              const tw = split.taskWork || 0, tp = split.taskPersonal || 0, tt = tw + tp || 1;
              return <>
                <div className="splitrow"><span className="splitlbl">Email</span><div className="splitbar"><span className="sbw" style={{ width: (ew / te * 100) + "%" }} /><span className="sbp" style={{ width: (ep / te * 100) + "%" }} /></div><span className="splitnum">{ew}/{ep}</span></div>
                <div className="splitrow"><span className="splitlbl">Tasks</span><div className="splitbar"><span className="sbw" style={{ width: (tw / tt * 100) + "%" }} /><span className="sbp" style={{ width: (tp / tt * 100) + "%" }} /></div><span className="splitnum">{tw}/{tp}</span></div>
                <div className="splitlegend"><span><span className="sbw dot" /> Work</span><span><span className="sbp dot" /> Personal</span></div>
              </>;
            })()}
          </div>
        </div>

        {/* Archived / Cleared */}
        <div className="widget wclick" onClick={() => go("inbox")}>
          <div className="whead"><span className="wicon"><M i="inventory_2" /></span><span className="wtitle">Cleared</span></div>
          <div className="wbody">
            <div className="wrow split"><span className="wrl">Emails archived/done</span><span className="wrr">{cleared.emails || 0}</span></div>
            <div className="wrow split"><span className="wrl">Tasks completed</span><span className="wrr">{cleared.tasks || 0}</span></div>
          </div>
          <div className="wfoot">View handled <M i="arrow_forward" /></div>
        </div>

        {/* Shared Media */}
        <div className="widget">
          <div className="whead"><span className="wicon"><M i="bookmark" /></span><span className="wtitle">Shared Media</span><span className="wcount">{sharedTotal}</span></div>
          <div className="wbody">
            {sharedCats.length === 0 && <div className="wmuted">Share links from your phone/browser — they'll be analyzed and filed here.</div>}
            <div className="smchips">
              {sharedCats.slice(0, 8).map((c) => (
                <button className="smchip" key={c.name} onClick={() => { try { sessionStorage.setItem("savedFilter", c.name); } catch {} go("saved"); }}>{c.name}<span className="smc">{c.n}</span></button>
              ))}
            </div>
          </div>
          <div className="wfoot" onClick={() => go("saved")}>Open Saved <M i="arrow_forward" /></div>
        </div>
      </div>

      {briefOpen && <div className="briefexpand">{children}</div>}
    </>
  );
}
