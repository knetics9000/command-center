"use client";
import { useTabs } from "./Tabs";
import Widget from "./Widget";
import Donut from "./Donut";
import Avatar from "./Avatar";
import HealthCard from "./HealthCard";
import NotifyWidget from "./NotifyWidget";

const M = ({ i }) => <span className="material-symbols-outlined">{i}</span>;
const Row = ({ children }) => <div className="wrow">{children}</div>;
const Split = ({ l, r }) => <div className="wrow split"><span className="wrl">{l}</span><span className="wrr">{r}</span></div>;
const emailRows = (arr, n) => arr.slice(0, n).map((e, i) => <Row key={i}><b>{e.sender}</b> · {e.subject}</Row>);

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

      {/* Overview — key numbers + donuts */}
      <Widget icon="space_dashboard" accent="" title="Overview"
        preview={<span className="wmuted">{overview.map((c) => `${c.n} ${c.l.toLowerCase()}`).join(" · ")}</span>}>
        <div className="ov-donuts">
          {overview.map((c, i) => (
            <div className="ov-cell" key={i}>
              <Donut pct={c.pct} color={c.color}><span className="dpct">{c.pct}%</span></Donut>
              <div className="ov-meta"><b>{c.n}</b><span>{c.l}</span><em>{c.sub}</em></div>
            </div>
          ))}
        </div>
      </Widget>

      <HealthCard />
      <NotifyWidget />

      {/* Today's Briefing — full briefing in the expansion */}
      <Widget icon="auto_awesome" accent="brief" title="Today's Briefing"
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

      {/* Priority Emails */}
      <Widget icon="star" accent="gold" title="Priority Emails" count={prioCount} countTone="gold" openTab="inbox" openLabel="Open Priority"
        preview={prioTop.length ? emailRows(prioTop, 2) : <div className="wmuted">No priority emails.</div>}>
        {prioTop.length ? emailRows(prioTop, 8) : <div className="wmuted">No priority emails right now.</div>}
      </Widget>

      {/* Needs Attention */}
      <Widget icon="priority_high" accent="red" title="Needs Attention" count={actCount} countTone="red" openTab="inbox" openLabel="Open Inbox"
        preview={inboxTop.length ? emailRows(inboxTop, 2) : <div className="wmuted">Inbox is clear 🌿</div>}>
        {inboxTop.length ? emailRows(inboxTop, 8) : <div className="wmuted">Inbox is clear 🌿</div>}
      </Widget>

      {/* Active Projects */}
      <Widget icon="account_tree" title="Active Projects" count={projectsCount} openTab="projects" openLabel="Open Projects"
        preview={projectsTop.slice(0, 2).map((p, i) => <Split key={i} l={p.name} r={`${p.open} open · ${p.pct}%`} />)}>
        {projectsTop.map((p, i) => <Split key={i} l={p.name} r={`${p.open} open · ${p.pct}%`} />)}
      </Widget>

      {/* To-Do */}
      <Widget icon="checklist" title="To-Do" count={todoOpen} openTab="todo" openLabel="Open To-Do"
        preview={todoTop.slice(0, 3).map((t, i) => <Split key={i} l={t.tag} r={t.count} />)}>
        {todoTop.map((t, i) => <Split key={i} l={t.tag} r={t.count} />)}
      </Widget>

      {/* Upcoming */}
      <Widget icon="event_upcoming" accent="teal" title="Upcoming" openTab="calendar" openLabel="Open Calendar"
        preview={dueTop.length ? dueTop.slice(0, 2).map((d, i) => <Split key={i} l={`${d.isTask ? "✓ " : ""}${d.summary}`} r={d.when} />) : <div className="wmuted">Nothing on the horizon.</div>}>
        {dueTop.length ? dueTop.map((d, i) => <Split key={i} l={`${d.isTask ? "✓ " : ""}${d.summary}`} r={d.when} />) : <div className="wmuted">Nothing on the horizon.</div>}
      </Widget>

      {/* AI Cleanup */}
      <Widget icon="auto_fix_high" accent="accent" title="AI Cleanup" count={cleanupCount || null} countTone="accent" openTab="cleanup" openLabel="Open organizer"
        preview={<div className="wmuted">{cleanupCount > 0 ? `${cleanupCount} suggestions ready.` : "Tasks look organized."}</div>}>
        <div className="wmuted">{cleanupCount > 0 ? `${cleanupCount} suggestions to organize your tasks & spot new projects.` : "Tasks look organized. Open to re-scan."}</div>
      </Widget>

      {/* AI-Suggested next actions */}
      <Widget icon="lightbulb" accent="brief" title="AI-Suggested Tasks" openTab="todo" openLabel="Open To-Do"
        preview={suggestedTasks.length ? suggestedTasks.slice(0, 2).map((t, i) => <Row key={i}>○ {t}</Row>) : <div className="wmuted">No suggestions right now.</div>}>
        {suggestedTasks.length ? suggestedTasks.map((t, i) => <Row key={i}>○ {t}</Row>) : <div className="wmuted">No suggestions right now.</div>}
      </Widget>

      {/* Shared Media */}
      <Widget icon="bookmark" title="Shared Media" count={sharedTotal} openTab="saved" openLabel="Open Saved"
        preview={sharedCats.length ? <span className="wmuted">{sharedCats.slice(0, 3).map((c) => c.name).join(" · ")}</span> : <div className="wmuted">Nothing shared yet.</div>}>
        {sharedCats.length === 0 && <div className="wmuted">Share links from your phone/browser — they'll be analyzed and filed here.</div>}
        <div className="smchips">
          {sharedCats.slice(0, 10).map((c) => (
            <button className="smchip" key={c.name} onClick={() => { try { sessionStorage.setItem("savedFilter", c.name); } catch {} go("saved"); }}>{c.name}<span className="smc">{c.n}</span></button>
          ))}
        </div>
      </Widget>

      {/* Recent Contacts */}
      <Widget icon="group" title="Recent Contacts" openTab="inbox" openLabel="Open Inbox"
        preview={contacts.length ? <span className="wmuted">{contacts.slice(0, 3).map((c) => c.name).join(", ")}</span> : <div className="wmuted">No recent contacts.</div>}>
        <div className="wcontacts">
          {contacts.map((c, i) => <div className="wcontact" key={i}><Avatar name={c.name} size={26} /><span className="wcname">{c.name}</span>{c.n > 1 && <span className="wcn">{c.n}</span>}</div>)}
        </div>
      </Widget>

      {/* Work / Personal split */}
      <Widget icon="balance" accent="teal" title="Work / Personal"
        preview={<span className="wmuted">Email {ew}/{ep} · Tasks {tw}/{tp}</span>}>
        <div className="splitrow"><span className="splitlbl">Email</span><div className="splitbar"><span className="sbw" style={{ width: (ew / te * 100) + "%" }} /><span className="sbp" style={{ width: (ep / te * 100) + "%" }} /></div><span className="splitnum">{ew}/{ep}</span></div>
        <div className="splitrow"><span className="splitlbl">Tasks</span><div className="splitbar"><span className="sbw" style={{ width: (tw / tt * 100) + "%" }} /><span className="sbp" style={{ width: (tp / tt * 100) + "%" }} /></div><span className="splitnum">{tw}/{tp}</span></div>
        <div className="splitlegend"><span><span className="sbw dot" /> Work</span><span><span className="sbp dot" /> Personal</span></div>
      </Widget>

      {/* Cleared */}
      <Widget icon="inventory_2" title="Cleared" openTab="inbox" openLabel="View handled"
        preview={<span className="wmuted">{cleared.emails || 0} emails · {cleared.tasks || 0} tasks</span>}>
        <Split l="Emails archived/done" r={cleared.emails || 0} />
        <Split l="Tasks completed" r={cleared.tasks || 0} />
      </Widget>

      {/* Performance */}
      <Widget icon="trending_up" accent="accent" title="Performance"
        preview={<span className="wmuted">{perf.pct || 0}% of tasks done</span>}>
        <div className="perf-sub">You've completed {perf.pct || 0}% of your tasks — {perf.done || 0} done, {perf.open || 0} still open.</div>
        <div className="perf-num"><b>{perf.done || 0}</b><span>Tasks done</span></div>
      </Widget>

    </div>
  );
}
