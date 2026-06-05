import { getStats, getInbox, getProjects, getTodoGroups, tagsOf, tagClass } from "@/lib/queries";
import { connectionStatus, listEvents } from "@/lib/google";
import RefreshButton from "./RefreshButton";

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
const ringColor = (p) => (p >= 66 ? "#7E9A86" : p >= 33 ? "#E0A23C" : "#D2745A");
const rel = (x) => {
  const s = (Date.now() - new Date(x)) / 1000; if (isNaN(s)) return "";
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  const d = Math.round(s / 86400); return d < 7 ? d + "d" : new Date(x).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default async function Home() {
  const stats = getStats();
  const inbox = getInbox();
  const projects = getProjects();
  const todo = getTodoGroups();
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

      <div className="card full" style={{ marginTop: 18 }}>
        <div className="sec-h"><span className="star">★</span> Project Tracker — where you left off</div>
        <div className="projgrid">
          {projects.length === 0 && <div style={{ color: "var(--muted)" }}>No projects tagged in Offload yet.</div>}
          {projects.map((p) => (
            <div className="proj" key={p.tag}>
              <div className="pn">{p.name}<span className="badge">{p.open} open</span></div>
              <div className="ring" data-p={p.pct} style={{ background: `conic-gradient(${ringColor(p.pct)} ${p.pct}%, #EEE7D7 0)` }} />
              <div className="meta"><span className="k">Last</span> {p.last}</div>
              <div className="next">Next: {p.next}</div>
              <div className="open">{p.total} total · {p.pct}% done</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bento" style={{ marginTop: 18 }}>
        <div className="col">
          <div className="card">
            <div className="sec-h">To-Do · by tag <span className="grow" /><span style={{ color: "var(--acc-deep)", fontWeight: 700 }}>{todo.openTotal} open</span></div>
            {todo.order.map((t) => {
              const list = todo.groups[t];
              const dot = tagClass(t) === "personal" ? "#7E9A86" : tagClass(t) === "work" ? "#C2851E" : tagClass(t) === "project" ? "#6b5a8e" : "#b5ae9f";
              return (
                <div className="cat" key={t}>
                  <div className="cat-h"><span className="dot" style={{ background: dot }} /><span className="nm">{t}</span><span className="c">{list.length}</span></div>
                  {list.slice(0, 6).map((it) => (
                    <div className="task" key={it.id}>
                      <span className="cbx" /><span className="tl">{it.text}</span>
                      <span className="tagrow">{tagsOf(it.tags).map((x) => <span className={"tagchip " + tagClass(x)} key={x}>{x}</span>)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
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

      <div className="card full" style={{ marginTop: 18 }}>
        <div className="sec-h">Unified Inbox · personal + work</div>
        {inbox.risky.length > 0 && (
          <div className="alarm">
            <h3>⚠ Possible phishing / fraud — verify before clicking</h3>
            {inbox.risky.map((e) => <div className="it" key={e.id}><b>{e.sender}</b> &lt;{e.sender_addr}&gt; — {e.subject}{e.risk_why ? " · " + e.risk_why : ""}</div>)}
          </div>
        )}
        {inbox.tiers.map((t) => {
          const list = inbox.byTier[t.key]; if (!list.length) return null;
          const show = t.key === "noise" ? list.slice(0, 4) : list;
          return (
            <div key={t.key}>
              <div className="tier-h"><span>{t.emoji}</span><span className="n">{t.label}</span><span className="c">{list.length}</span><span className="rl" /></div>
              {show.map((e) => (
                <div className={"mail " + e.triage_tier} key={e.id}>
                  <div className="mt"><span className={"tag " + e.account}>{e.account === "work" ? "Work" : "Personal"}</span><span className="snd">{e.sender}</span><span className="addr">{e.sender_addr}</span><span className="tmm">{rel(e.received_at)}</span></div>
                  <div className="subj">{e.subject}</div><div className="why">{e.why}</div>
                  {e.action && <div className="nx"><b>Next:</b> {e.action}</div>}
                </div>
              ))}
              {t.key === "noise" && list.length > 4 && <div style={{ color: "var(--muted)", fontSize: 12, padding: "2px 4px" }}>+{list.length - 4} more</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
