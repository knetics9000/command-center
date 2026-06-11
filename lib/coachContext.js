// Pure assembly for the coach context bundle. No DB/network here — caller fetches, this shapes.

/** A Google Calendar event item → compact shape. start/end may be dateTime or all-day date. */
function mapEvent(ev, account) {
  const start = ev.start?.dateTime || ev.start?.date || null;
  const end = ev.end?.dateTime || ev.end?.date || null;
  return { title: ev.summary || "(no title)", start, end, location: ev.location || null, account };
}

/** Build the coach context bundle from raw inputs.
 *  @param now ISO string (server local)
 *  @param eventsByAccount [{account, events:[gcal items]}]
 *  @param tasks rows from getOpenTasks() (have id, text, due, created_at)
 *  @param projects rows from getProjects() (have name, tag, open, next)
 *  @param briefing getLatestBriefing() result or null
 */
export function assembleCoachBundle({ now, eventsByAccount = [], tasks = [], projects = [], briefing = null, lifeDigest = null }) {
  const calendar = eventsByAccount
    .flatMap(({ account, events }) => (events || []).map((e) => mapEvent(e, account)))
    .filter((e) => e.start)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  const openTasks = [...tasks]
    .sort((a, b) => {
      // due-soonest first (tasks without a due date go after dated ones), then most recent.
      // ISO YYYY-MM-DD strings sort correctly lexicographically; "9999-12-31" sentinel pushes undated last.
      const ad = a.due || "9999-12-31", bd = b.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    })
    .slice(0, 15)
    .map((t) => ({ id: t.id, text: t.text, due: t.due || null }));

  const activeProjects = (projects || [])
    .filter((p) => (p.open || 0) > 0)
    .slice(0, 12)
    .map((p) => ({ name: p.name, tag: p.tag, open: p.open || 0, next: p.next || null }));

  let latestBriefing = null;
  if (briefing) {
    const priorities = Array.isArray(briefing.priorities) ? briefing.priorities : [];
    const summary = [briefing.greeting, ...priorities.slice(0, 3).map((p) => p.title).filter(Boolean)]
      .filter(Boolean).join(" · ");
    latestBriefing = { generatedAt: briefing.generated_at || null, summary: summary || null };
  }

  return { now, calendar, openTasks, activeProjects, latestBriefing, lifeDigest: lifeDigest || null };
}
