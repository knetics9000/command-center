"use client";
import { createContext, useContext, useState, useEffect } from "react";

const TabCtx = createContext({ tab: "dashboard", setTab: () => {} });
export const useTabs = () => useContext(TabCtx);

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "assistant", label: "Assistant", icon: "smart_toy" },
  { id: "cleanup", label: "Cleanup", icon: "auto_fix_high" },
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "projects", label: "Projects", icon: "account_tree" },
  { id: "todo", label: "To-Do", icon: "checklist" },
  { id: "calendar", label: "Calendar", icon: "calendar_today" },
  { id: "saved", label: "Saved", icon: "bookmark" },
];

export function TabsProvider({ children }) {
  const [tab, setTabState] = useState("dashboard");
  // restore the tab within a session so router.refresh()/reloads don't bounce to Dashboard
  useEffect(() => {
    try { const saved = sessionStorage.getItem("cc_tab"); if (saved && TABS.some((t) => t.id === saved)) setTabState(saved); } catch {}
  }, []);
  const setTab = (t) => { setTabState(t); try { sessionStorage.setItem("cc_tab", t); } catch {} };
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
