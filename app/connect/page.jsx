import { connectionStatus } from "@/lib/google";

export const dynamic = "force-dynamic";

const LABEL = {
  personal: process.env.ACCOUNT_PERSONAL || "Personal",
  work: process.env.ACCOUNT_WORK || "Work",
};

export default function Connect({ searchParams }) {
  const st = connectionStatus();
  const justConnected = searchParams?.connected;
  const error = searchParams?.error;
  const haveKeys = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h1 className="serif" style={{ fontSize: 28, margin: "0 0 4px" }}>Connect accounts</h1>
      <p style={{ color: "var(--ink2)", marginTop: 0 }}>
        Authorize Gmail (read + modify) and Calendar for each account. Tokens are stored in SQLite.
      </p>

      {!haveKeys && (
        <div className="card" style={{ borderColor: "#E7C98A", background: "#FFF8EC", marginBottom: 14 }}>
          ⚠ <b>GOOGLE_CLIENT_ID / SECRET not set in <code>.env</code></b> yet — add them, then restart the dev server.
        </div>
      )}
      {justConnected && <div className="card" style={{ marginBottom: 14, background: "#E7EFE8" }}>✓ Connected {LABEL[justConnected] || justConnected}.</div>}
      {error && <div className="card" style={{ marginBottom: 14, background: "#F8E2DA", color: "#9A4226" }}>⚠ {error}</div>}

      {st.map((s) => (
        <div key={s.account} className="card" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{LABEL[s.account]}</div>
            <div style={{ fontSize: 12.5, color: s.connected ? "var(--acc-deep)" : "var(--muted)" }}>
              {s.connected ? `connected${s.email ? " · " + s.email : ""}` : "not connected"}
            </div>
          </div>
          <a
            href={`/api/google/auth?account=${s.account}`}
            className="badge"
            style={{ padding: "8px 14px", textDecoration: "none", pointerEvents: haveKeys ? "auto" : "none", opacity: haveKeys ? 1 : 0.5 }}
          >
            {s.connected ? "Reconnect" : "Connect"}
          </a>
        </div>
      ))}

      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        On the Google screen, if you see “unverified app”, click <b>Advanced → Go to Command Center</b> — it’s your own app.
      </p>
    </div>
  );
}
