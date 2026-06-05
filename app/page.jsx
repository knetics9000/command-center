import { getStats, getInbox, getProjects, getTodoGroups, getLatestBriefing, getProjectTags } from "@/lib/queries";
import { connectionStatus, listEvents } from "@/lib/google";
import RefreshButton from "./RefreshButton";
import Briefing from "./Briefing";
import Projects from "./Projects";
import Todo from "./Todo";
import Inbox from "./Inbox";

export const dynamic = "force-dynamic";

function weekRange() {
  const now = new Date(); const d = new Date(now);
  const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); d.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setDate(d.getDate() + 7);
  return { start: d, end };
}
async function getCalendar() {
  const conn = connectionStatus().find((c) => c.account === "personal");
  if (!conn || !conn.connected) return { events: [], connected: false };
  const { start, end } = weekRange();
  let evs = [];
  for (const [acc, color] of [["personal", "#7E9A86"], ["work", "#C2851E"]]) {
    try {
      const items = await listEvents(acc, start.toISOString(), end.toISOString());
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
  const projects = getProjects();
  const todo = getTodoGroups();
  const briefing = getLatestBriefing();
  const projectTags = getProjectTags();
  const conn = connectionStatus();
  const cal = await getCalendar();

  const now = new Date();
  const { start } = weekRange();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const dn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = cal.events.filter((e) => new Date(e.start).toDateString() === now.toDateString());
  const nextEv = cal.events.filter((e) => !e.allDay && new Date(e.start) > now)[0];

  return (
    <div className="wrap">
      <div className="top">
        <div>
          <h1 className="hello">Welcome back, Kurt</h1>
          <div className="sub">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · here's where you left off</div>
        </div>
        <div>
          <div className="synced">{conn.every((c) => c.connected) ? "both accounts connected ✓" : <a href="/connect">connect accounts →</a>}</div>
          <RefreshButton />
        </div>
      </div>

      <div className="stats card" style={{ padding: "18px 22px" }}>
        <div className="stat"><div className="n"><b>{stats.openTasks}</b></div><div className="l">Open tasks</div></div>
        <div className="stat"><div className="n"><b>{stats.inbox}</b></div><div className="l">Inbox · {stats.act} act now</div></div>
        <div className="stat"><div className="n"><b>{today.length}</b></div><div className="l">Events today</div></div>
        <div className="stat"><div className="n"><b>{stats.projects}</b></div><div className="l">Active projects</div></div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Briefing briefing={briefing} existingTags={projectTags} />
      </div>

      <div style={{ marginTop: 18 }}>
        <Projects projects={projects} />
      </div>

      <div className="bento" style={{ marginTop: 18 }}>
        <div className="col">
          <Todo order={todo.order} groups={todo.groups} openTotal={todo.openTotal} />
        </div>

        <div className="col">
          <div className="card">
            <div className="sec-h">Calendar · this week</div>
            {!cal.connected && <div style={{ color: "var(--muted)" }}><a href="/connect">Connect calendar →</a></div>}
            <div className="week">
              {days.map((d, i) => {
                const isT = d.toDateString() === now.toDateString();
                const has = cal.events.some((e) => new Date(e.start).toDateString() === d.toDateString());
                return <div className={"day" + (isT ? " today" : "")} key={i}><div className="dn">{dn[i]}</div><div className="dd">{d.getDate()}</div>{has && <div className="pip" />}</div>;
              })}
            </div>
            {(today.length ? today : cal.events.slice(0, 5)).map((e, i) => {
              const d = new Date(e.start);
              const tm = e.allDay ? "all day" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              const isNext = nextEv && e === nextEv;
              return (
                <div className={"ev" + (isNext ? " next" : "")} key={i}>
                  <div className="tm">{tm}</div><span className="acctk" style={{ background: e.color }} />
                  <div><div className="ti">{isNext ? <b>{e.summary}</b> : e.summary}</div><div className="loc">{e.location || (e.account === "work" ? "Work" : "Personal")}</div></div>
                </div>
              );
            })}
            {cal.connected && cal.events.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Nothing scheduled. 🌿</div>}
          </div>
        </div>
      </div>

      <Inbox tiers={inbox.tiers} byTier={inbox.byTier} risky={inbox.risky} />
    </div>
  );
}
