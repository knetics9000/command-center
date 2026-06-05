import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const db = getDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
  const counts = tables.map((t) => ({ t, n: db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c }));

  return (
    <div className="wrap">
      <h1 className="serif" style={{ fontSize: 32, margin: "0 0 4px" }}>
        Command Center
      </h1>
      <p style={{ color: "var(--ink2)", marginTop: 0 }}>
        Autonomous build · <span className="badge">Phase 0 — scaffold</span>
      </p>

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, marginBottom: 12 }}>
          Database ({tables.length} tables)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
          {counts.map(({ t, n }) => (
            <div key={t} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 13px" }}>
              <div style={{ fontWeight: 700 }}>{t}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{n} rows</div>
            </div>
          ))}
        </div>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 18 }}>
        Next: Phase 1 — Google OAuth (both accounts), Gmail read/modify, Calendar write, Offload sync, Claude client.
      </p>
    </div>
  );
}
