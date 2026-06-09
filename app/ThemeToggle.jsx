"use client";
import { useState, useEffect } from "react";

/** Executive Dark ⇄ Classic switch. Executive Dark is the default (approved);
 *  Classic remains an opt-out, persisted per device via localStorage. */
export default function ThemeToggle() {
  const [exec, setExec] = useState(true);
  useEffect(() => { try { setExec(localStorage.getItem("cc-theme") !== "v1"); } catch {} }, []);

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
