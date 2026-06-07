import { getStats, getInbox, getHandledInbox, getProjects, getTodoGroups, getLatestBriefing, getProjectTags, getDueTasks, getLastSync, getBucketSummary, getRecentContacts, getSplit, getClearedSummary } from "@/lib/queries";
import { connectionStatus, listEvents } from "@/lib/google";
import RefreshButton from "./RefreshButton";
import TopUtility from "./TopUtility";
import Fab from "./Fab";
import Donut from "./Donut";
import Briefing from "./Briefing";
import Projects from "./Projects";
import Todo from "./Todo";
import Inbox from "./Inbox";
import DashGrid from "./DashGrid";
import Buckets from "./Buckets";
import CleanupView from "./CleanupView";
import AssistantChat from "./AssistantChat";
import SavedView from "./SavedView";
import HealthCard from "./HealthCard";
import { cleanupCount } from "@/lib/cleanup";
import { getPriorityInbox } from "@/lib/priority";
import { categoryCounts } from "@/lib/share";
import { TabsProvider, TabBar, TabPanel } from "./Tabs";

export const dynamic = "force-dynamic";

function weekRange() {
  const now = new Date(); const d = new Date(now);
  const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); d.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setDate(d.getDate() + 7);
  return { start: d, end };
}
function monthGrid() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const startWd = first.getDay();                    // Sunday = 0
  const gridStart = new Date(first); gridStart.setDate(1 - startWd); gridStart.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
  const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + 42);
  return { days, gridStart, gridEnd, month: now.getMonth() };
}
async function getCalendar(timeMin, timeMax) {
  const conn = connectionStatus().find((c) => c.account === "personal");
  if (!conn || !conn.connected) return { events: [], connected: false };
  let evs = [];
  for (const [acc, color] of [["personal", "#4648d4"], ["work", "#14B8A6"]]) {
    try {
      const items = await listEvents(acc, timeMin, timeMax);
      evs = evs.concat(items.map((e) => ({
        account: acc, color, summary: e.summary || "(busy)", location: e.location || "",
        allDay: !!(e.start && e.start.date && !e.start.dateTime),
        start: (e.start && (e.start.dateTime || e.start.date)) || "",
      })));
    } catch {}
  }
  evs.sort((a, b) => new Date(a.start) - new Date(b.start));
  return { events: evs, connected: true };
}
export default async function Home() {
  const stats = getStats();
  const inbox = getInbox();
  const handled = getHandledInbox();
  const projects = getProjects();
  const todo = getTodoGroups();
  const briefing = getLatestBriefing();
  const projectTags = getProjectTags();
  const conn = connectionStatus();
  const now = new Date();
  const grid = monthGrid();
  const cal = await getCalendar(grid.gridStart.toISOString(), grid.gridEnd.toISOString());

  const dueEvents = getDueTasks(grid.gridStart.toISOString().slice(0, 10), grid.gridEnd.toISOString().slice(0, 10))
    .map((t) => ({ summary: t.text, location: "", allDay: true, isTask: true, color: "#8B5CF6", start: t.due + "T12:00:00" }));
  const events = [...cal.events, ...dueEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
  const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const gcalDay = (d) => `https://calendar.google.com/calendar/r/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  const sameDay = (a, b) => new Date(a).toDateString() === b.toDateString();
  const today = events.filter((e) => sameDay(e.start, now));
  const nextEv = events.filter((e) => !e.allDay && new Date(e.start) > now)[0];
  // next 7 days (tomorrow → +7), grouped by day for the "This Week" panel
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(now.getDate() + 1 + i); d.setHours(0, 0, 0, 0); return d; });
  const week = weekDays.map((d) => ({ date: d, label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }), events: events.filter((e) => sameDay(e.start, d)) }));
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const connected = conn.every((c) => c.connected);
  const personal = conn.find((c) => c.account === "personal") || {};

  // dashboard widget summaries
  const actTop = (inbox.byTier.act || []).slice(0, 3).map((e) => ({ sender: e.sender, subject: e.subject }));
  const projTop = projects.slice(0, 3).map((p) => ({ name: p.name, open: p.open, pct: p.pct }));
  const todoTop = todo.order.slice(0, 4).map((t) => ({ tag: t, count: todo.groups[t].length }));
  const fmtWhen = (e) => { const d = new Date(e.start); return e.isTask ? "due " + d.toLocaleDateString([], { month: "short", day: "numeric" }) : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + (e.allDay ? "" : " " + d.toLocaleTimeString([], { hour: "numeric" })); };
  const upcoming = events.filter((e) => new Date(e.start) >= now).slice(0, 4).map((e) => ({ summary: e.summary, isTask: e.isTask, when: fmtWhen(e) }));
  const clCount = cleanupCount();
  const prioList = getPriorityInbox(4);
  const prioTop = prioList.map((e) => ({ sender: e.sender, subject: e.subject }));
  const contacts = getRecentContacts(5).map((c) => ({ name: c.sender, addr: c.sender_addr, n: c.n }));
  const split = getSplit();
  const cleared = getClearedSummary();
  const suggestedTasks = (briefing && briefing.priorities || []).slice(0, 3).map((p) => p.title);
  const sharedCats = categoryCounts();
  const sharedTotal = sharedCats.reduce((n, c) => n + c.n, 0);

  return (
    <TabsProvider>
      <div className="appwrap">
        <header className="apptop">
          <div className="ah-brand"><span className="ah-logo material-symbols-outlined">bolt</span><span className="ah-name">Command Center</span></div>
          <TopUtility actCount={stats.act} pic={personal.picture} email={personal.email} />
        </header>
        <div className="tabstrip"><TabBar /></div>
        <main className="workspace2">
          <div className="wrap">

          <TabPanel name="dashboard">
          <header className="topbar">
            <div>
              <h1 className="hello">Welcome back, Kurt</h1>
              <div className="sub">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · here's where you left off</div>
            </div>
            <div className="tb-right">
              <RefreshButton />
              <div className="synced">{connected ? "both accounts connected ✓" : <a href="/connect">connect accounts →</a>}</div>
            </div>
          </header>

      <div className="stats">
        <HealthCard />
        {(() => {
          const taskPct = stats.openTasks + stats.doneTasks ? Math.round((stats.doneTasks / (stats.openTasks + stats.doneTasks)) * 100) : 0;
          const inboxPct = stats.inbox ? Math.round((stats.act / stats.inbox) * 100) : 0;
          const evPct = Math.min(100, today.length * 20);
          const cards = [
            { n: stats.openTasks, l: "Open tasks", sub: taskPct + "% done", pct: taskPct, color: "#4648d4" },
            { n: stats.inbox, l: "Inbox", sub: stats.act + " act now", pct: inboxPct, color: "#ba1a1a" },
            { n: today.length, l: "Events today", sub: "this week", pct: evPct, color: "#14B8A6" },
            { n: stats.projects, l: "Active projects", sub: stats.avgProj + "% avg", pct: stats.avgProj, color: "#904900" },
          ];
          return cards.map((c, i) => (
            <div className="statcard card" key={i}>
              <div className="statinfo"><div className="n"><b>{c.n}</b></div><div className="l">{c.l}</div><div className="sl">{c.sub}</div></div>
              <Donut pct={c.pct} color={c.color}><span className="dpct">{c.pct}%</span></Donut>
            </div>
          ));
        })()}
      </div>

      {(() => {
        const tp = stats.openTasks + stats.doneTasks ? Math.round((stats.doneTasks / (stats.openTasks + stats.doneTasks)) * 100) : 0;
        return (
          <div className="perfcard" style={{ marginTop: 18 }}>
            <div className="perf-main">
              <div className="perf-h">Performance</div>
              <div className="perf-sub">You've completed {tp}% of your tasks — {stats.doneTasks} done, {stats.openTasks} still open.</div>
              <div className="perf-num"><b>{stats.doneTasks}</b><span>Tasks done</span></div>
            </div>
            <span className="material-symbols-outlined perf-ic">trending_up</span>
            <span className="perf-blur" />
          </div>
        );
      })()}

      <div style={{ marginTop: 18 }}>
        <DashGrid briefing={briefing} inboxTop={actTop} actCount={stats.act} projectsTop={projTop} projectsCount={stats.projects} todoTop={todoTop} todoOpen={todo.openTotal} dueTop={upcoming} cleanupCount={clCount} prioTop={prioTop} prioCount={inbox.priorityCount} contacts={contacts} split={split} cleared={cleared} suggestedTasks={suggestedTasks} sharedCats={sharedCats} sharedTotal={sharedTotal}>
          <Briefing briefing={briefing} existingTags={projectTags} />
        </DashGrid>
      </div>
          </TabPanel>

          <TabPanel name="assistant">
            <AssistantChat />
          </TabPanel>

          <TabPanel name="cleanup">
            <CleanupView />
          </TabPanel>

          <TabPanel name="projects">
            <Buckets buckets={getBucketSummary()} />
            <Projects projects={projects} />
          </TabPanel>

          <TabPanel name="todo">
            <Todo order={todo.order} groups={todo.groups} openTotal={todo.openTotal} />
          </TabPanel>

          <TabPanel name="calendar">
      <div className="calsection">
        <div className="card calmonth">
          <div className="sec-h">Calendar<span className="grow" /><span className="monthlbl">{monthLabel}</span></div>
          {!cal.connected && <div style={{ color: "var(--muted)" }}><a href="/connect">Connect calendar →</a></div>}
          <div className="mgrid mgrid-h">{dn.map((d) => <div className="mh" key={d}>{d}</div>)}</div>
          <div className="mgrid">
            {grid.days.map((d, i) => {
              const dayEvs = events.filter((e) => sameDay(e.start, d));
              const isT = sameDay(now, d);
              const dim = d.getMonth() !== grid.month;
              return (
                <a className={"mcell" + (isT ? " today" : "") + (dim ? " dim" : "")} key={i} href={gcalDay(d)} target="_blank" rel="noreferrer" title="Open this day in Google Calendar">
                  <div className="mdate">{d.getDate()}</div>
                  {dayEvs.slice(0, 3).map((e, j) => (
                    <div className={"mchip" + (e.isTask ? " task" : "")} key={j} style={{ "--c": e.color }} title={e.summary}>
                      {!e.allDay && <span className="mct">{new Date(e.start).toLocaleTimeString([], { hour: "numeric" })}</span>}{e.isTask ? "✓ " : ""}{e.summary}
                    </div>
                  ))}
                  {dayEvs.length > 3 && <div className="mmore">+{dayEvs.length - 3}</div>}
                </a>
              );
            })}
          </div>
        </div>

        <div className="card caltoday">
          <div className="sec-h">Today<span className="grow" /><span className="monthlbl">{now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></div>
          <div className="tline">
            {today.filter((e) => !e.allDay).length === 0 && today.length === 0 && <div className="tlempty">Nothing scheduled today. 🌿</div>}
            {today.map((e, i) => {
              const d = new Date(e.start);
              const tm = e.isTask ? "due" : e.allDay ? "all day" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              const isNext = nextEv && e === nextEv;
              return (
                <div className={"tlrow" + (isNext ? " next" : "")} key={i}>
                  <div className="tltime">{tm}</div>
                  <div className="tlbar" style={{ background: e.color }} />
                  <div className="tlbody"><div className="tlsum">{e.isTask ? "✓ " : ""}{e.summary}</div><div className="tlloc">{e.isTask ? "Task due" : (e.location || (e.account === "work" ? "Work" : "Personal"))}</div></div>
                </div>
              );
            })}
          </div>
          <div className="weekahead">
            <div className="wa-h">This Week</div>
            {week.map((d, i) => (
              <div className="wa-day" key={i}>
                <div className="wa-date">{d.label}</div>
                {d.events.length === 0
                  ? <div className="wa-empty">— nothing scheduled —</div>
                  : d.events.map((e, j) => (
                      <div className="wa-ev" key={j}>
                        <span className="wa-time">{e.isTask ? "due" : e.allDay ? "all day" : new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                        <span className="wa-bar" style={{ background: e.color }} />
                        <span className="wa-sum">{e.isTask ? "✓ " : ""}{e.summary}</span>
                      </div>
                    ))}
              </div>
            ))}
          </div>
        </div>
      </div>
          </TabPanel>

          <TabPanel name="saved">
            <SavedView projects={projects.map((p) => p.tag)} />
          </TabPanel>

          <TabPanel name="inbox">
            <Inbox tiers={inbox.tiers} byTier={inbox.byTier} risky={inbox.risky} handled={handled} projects={projects.map((p) => ({ tag: p.tag, name: p.name }))} priorityCount={inbox.priorityCount} />
          </TabPanel>

          </div>
        </main>
        <Fab />
      </div>
    </TabsProvider>
  );
}
