"use client";
import { useState, useEffect } from "react";

/** v1 ⇄ Executive Dark preview switch. v1 stays the default until the redesign
 *  is approved; the choice persists per device via localStorage. */
export default function ThemeToggle() {
  const [exec, setExec] = useState(false);
  useEffect(() => { try { setExec(localStorage.getItem("cc-theme") === "exec"); } catch {} }, []);

  function flip() {
    const next = !exec;
    setExec(next);
    try { localStorage.setItem("cc-theme", next ? "exec" : "v1"); } catch {}
    if (next) document.documentElement.setAttribute("data-theme", "exec");
    else document.documentElement.removeAttribute("data-theme");
  }

  return (
    <button className={"themetoggle" + (exec ? " on" : "")} onClick={flip} title={exec ? "Back to Classic" : "Preview Executive Dark"}>
      <span className="tt-diamond">◆</span><span className="tt-label">{exec ? "Classic" : "Executive"}</span>
    </button>
  );
}
