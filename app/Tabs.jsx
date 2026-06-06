"use client";
import { createContext, useContext, useState } from "react";

const TabCtx = createContext({ tab: "dashboard", setTab: () => {} });
export const useTabs = () => useContext(TabCtx);

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "projects", label: "Projects", icon: "account_tree" },
  { id: "todo", label: "To-Do", icon: "checklist" },
  { id: "calendar", label: "Calendar", icon: "calendar_today" },
];

export function TabsProvider({ children }) {
  const [tab, setTab] = useState("dashboard");
  return <TabCtx.Provider value={{ tab, setTab }}>{children}</TabCtx.Provider>;
}

export function TabBar() {
  const { tab, setTab } = useTabs();
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.id} className={"tabbtn" + (tab === t.id ? " on" : "")} onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <span className="material-symbols-outlined">{t.icon}</span>
          <span className="tablabel">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function TabPanel({ name, children }) {
  const { tab } = useTabs();
  return <div className="tabpanel" style={{ display: tab === name ? "block" : "none" }}>{children}</div>;
}

// Lets a dashboard widget jump to a tab.
export function GoTab({ to, className = "", children, onClick }) {
  const { setTab } = useTabs();
  return <button className={className} onClick={() => { setTab(to); window.scrollTo({ top: 0, behavior: "smooth" }); onClick && onClick(); }}>{children}</button>;
}
