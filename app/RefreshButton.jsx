"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function go() {
    setBusy(true);
    try { await fetch("/api/refresh", { method: "POST" }); router.refresh(); }
    finally { setBusy(false); }
  }
  return (
    <button className="rbtn" onClick={go} disabled={busy}>
      {busy ? "Syncing…" : "↻ Refresh"}
    </button>
  );
}
