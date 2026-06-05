// Route-level skeleton shown while the server component renders (live calendar fetch, etc.).
export default function Loading() {
  return (
    <div className="wrap" aria-busy="true">
      <div className="top">
        <div style={{ flex: 1 }}>
          <div className="sk sk-title" style={{ width: 280, height: 30 }} />
          <div className="sk sk-line" style={{ width: 200 }} />
        </div>
        <div className="sk" style={{ width: 110, height: 38, borderRadius: 11 }} />
      </div>

      <div className="stats card" style={{ padding: "18px 22px" }}>
        {[0, 1, 2, 3].map((i) => <div className="sk sk-stat" key={i} />)}
      </div>

      <div className="card full" style={{ marginTop: 18 }}>
        <div className="sk sk-title" />
        <div className="sk sk-line" /><div className="sk sk-line" style={{ width: "80%" }} /><div className="sk sk-line" style={{ width: "60%" }} />
      </div>

      <div className="card full" style={{ marginTop: 18 }}>
        <div className="sk sk-title" />
        <div className="projgrid">{[0, 1, 2].map((i) => <div className="sk sk-proj" key={i} />)}</div>
      </div>

      <div className="bento" style={{ marginTop: 18 }}>
        <div className="col"><div className="card"><div className="sk sk-title" /><div className="sk sk-card" /></div></div>
        <div className="col"><div className="card"><div className="sk sk-title" /><div className="sk sk-card" /></div></div>
      </div>
    </div>
  );
}
