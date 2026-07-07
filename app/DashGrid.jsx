"use client";
import { useTabs } from "./Tabs";
import Widget from "./Widget";
import Donut from "./Donut";
import Avatar from "./Avatar";
import HealthCard from "./HealthCard";
import NotifyWidget from "./NotifyWidget";
import KidsWidget from "./KidsWidget";
import ThoughtsWidget from "./ThoughtsWidget";
import PrimeWidget from "./PrimeWidget";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const Row = ({ children }) => <div className="wrow">{children}</div>;
const Split = ({ l, r }) => <div className="wrow split"><span className="wrl">{l}</span><span className="wrr">{r}</span></div>;
const Sec = ({ label, children }) => <div className="wsec"><div className="wsec-h">{label}</div>{children}</div>;
const emailRows = (arr, n) => arr.slice(0, n).map((e, i) => <Row key={i}><b>{e.sender}</b> · {e.subject}</Row>);

/** Consolidated dashboard: 8 calm tiles instead of 17.
 *  brief · kids · upcoming · inbox · tasks · notify · health · stats */
export default function DashGrid({
  briefing, inboxTop = [], actCount = 0, projectsTop = [], projectsCount = 0, todoTop = [], todoOpen = 0,
  dueTop = [], cleanupCount = 0, prioTop = [], prioCount = 0, contacts = [], split = {}, cleared = {},
  suggestedTasks = [], sharedCats = [], sharedTotal = 0, overview = [], perf = {}, children,
}) {
  const { setTab } = useTabs();
  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const ew = split.emailWork || 0, ep = split.emailPersonal || 0, te = ew + ep || 1;
  const tw = split.taskWork || 0, tp = split.taskPersonal || 0, tt = tw + tp || 1;

  return (
    <div className="w2grid">

      {/* 1 · Today's Briefing */}
      <Widget wkey="brief" icon="auto_awesome" accent="brief" title="Today's Briefing"
        preview={
          <>
            <div className="wbrief-greet">{briefing ? briefing.greeting : "No briefing yet."}</div>
            {(briefing && briefing.priorities || []).slice(0, 3).map((p, i) => (
              <div className="wbrief-p" key={i}><span className="wpn">{i + 1}</span><span className="wbrief-pt">{p.title}</span></div>
            ))}
          </>
        }>
        {children}
      </Widget>

      {/* 2 · Prime — hand-pinned top to-dos */}
      <PrimeWidget />

      {/* 3 · Kids (self-contained) */}
      <KidsWidget />

      {/* 3 · Upcoming */}
      <Widget wkey="upcoming" icon="event_upcoming" accent="teal" title="Upcoming" openTab="calendar" openLabel="Open Calendar"
        preview={dueTop.length ? dueTop.slice(0, 2).map((d, i) => <Split key={i} l={`${d.isTask ? "✓ " : ""}${d.summary}`} r={d.when} />) : <div className="wmuted">Nothing on the horizon.</div>}>
        {dueTop.length ? dueTop.map((d, i) => <Split key={i} l={`${d.isTask ? "✓ " : ""}${d.summary}`} r={d.when} />) : <div className="wmuted">Nothing on the horizon.</div>}
      </Widget>

      {/* 4 · Inbox — needs-attention + priority + contacts + cleared, one tile */}
      <Widget wkey="inbox" icon="mail" accent="red" title="Inbox" count={actCount} countTone={actCount > 0 ? "red" : ""} openTab="inbox" openLabel="Open Inbox"
        preview={inboxTop.length ? emailRows(inboxTop, 2) : <div className="wmuted">Inbox is clear 🌿</div>}>
        <Sec label={`Needs attention · ${actCount}`}>
          {inboxTop.length ? emailRows(inboxTop, 6) : <div className="wmuted">Nothing urgent.</div>}
        </Sec>
        <Sec label={`Priority senders · ${prioCount}`}>
          {prioTop.length ? emailRows(prioTop, 5) : <div className="wmuted">No priority emails.</div>}
        </Sec>
        {contacts.length > 0 && (
          <Sec label="Recent contacts">
            <div className="wcontacts">
              {contacts.slice(0, 6).map((c, i) => <div className="wcontact" key={i}><Avatar name={c.name} size={24} /><span className="wcname">{c.name}</span>{c.n > 1 && <span className="wcn">{c.n}</span>}</div>)}
            </div>
          </Sec>
        )}
        <div className="wmuted wfine">Cleared: {cleared.emails || 0} emails archived · {cleared.tasks || 0} tasks done</div>
      </Widget>

      {/* 5 · Tasks & Projects — to-do + projects + AI suggestions + cleanup, one tile */}
      <Widget wkey="tasks" icon="checklist" title="Tasks & Projects" count={todoOpen} openTab="todo" openLabel="Open To-Do"
        preview={todoTop.slice(0, 3).map((t, i) => <Split key={i} l={t.tag} r={t.count} />)}>
        <Sec label={`To-do · ${todoOpen} open`}>
          {todoTop.slice(0, 6).map((t, i) => <Split key={i} l={t.tag} r={t.count} />)}
        </Sec>
        <Sec label={`Projects · ${projectsCount}`}>
          {projectsTop.slice(0, 5).map((p, i) => <Split key={i} l={p.name} r={`${p.open} open · ${p.pct}%`} />)}
          <button className="linklike wsec-link" onClick={() => go("projects")}>Open Projects →</button>
        </Sec>
        {suggestedTasks.length > 0 && (
          <Sec label="AI suggests">
            {suggestedTasks.slice(0, 3).map((t, i) => <Row key={i}>○ {t}</Row>)}
          </Sec>
        )}
        <div className="wmuted wfine">
          {cleanupCount > 0 ? <>AI Cleanup has {cleanupCount} suggestions — <button className="linklike" onClick={() => go("cleanup")}>review →</button></> : "Tasks look organized."}
        </div>
      </Widget>

      {/* 6 · Thoughts (Offload long-form captures; reference) */}
      <ThoughtsWidget />

      {/* 7 · Phone notifications (self-contained; hides when empty) */}
      <NotifyWidget />

      {/* 7 · Health (self-contained) */}
      <HealthCard />

      {/* 8 · Stats — overview + performance + work/personal + saved, one tile */}
      <Widget wkey="stats" icon="monitoring" title="Stats & Saved" count={sharedTotal || null}
        preview={<span className="wmuted">{overview.map((c) => `${c.n} ${c.l.toLowerCase()}`).join(" · ")}</span>}>
        <div className="ov-donuts">
          {overview.map((c, i) => (
            <div className="ov-cell" key={i}>
              <Donut pct={c.pct} color={c.color}><span className="dpct">{c.pct}%</span></Donut>
              <div className="ov-meta"><b>{c.n}</b><span>{c.l}</span><em>{c.sub}</em></div>
            </div>
          ))}
        </div>
        <Sec label="Work / personal">
          <div className="splitrow"><span className="splitlbl">Email</span><div className="splitbar"><span className="sbw" style={{ width: (ew / te * 100) + "%" }} /><span className="sbp" style={{ width: (ep / te * 100) + "%" }} /></div><span className="splitnum">{ew}/{ep}</span></div>
          <div className="splitrow"><span className="splitlbl">Tasks</span><div className="splitbar"><span className="sbw" style={{ width: (tw / tt * 100) + "%" }} /><span className="sbp" style={{ width: (tp / tt * 100) + "%" }} /></div><span className="splitnum">{tw}/{tp}</span></div>
        </Sec>
        <Sec label={`Saved knowledge · ${sharedTotal}`}>
          <div className="smchips">
            {sharedCats.slice(0, 8).map((c) => (
              <button className="smchip" key={c.name} onClick={() => { try { sessionStorage.setItem("savedFilter", c.name); } catch {} go("saved"); }}>{c.name}<span className="smc">{c.n}</span></button>
            ))}
          </div>
        </Sec>
        <div className="wmuted wfine">You've completed {perf.pct || 0}% of your tasks — {perf.done || 0} done, {perf.open || 0} open.</div>
      </Widget>

    </div>
  );
}
