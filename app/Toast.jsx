"use client";
import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastCtx = createContext({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

let _id = 0;
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setItems((x) => x.filter((t) => t.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const toast = useCallback((opts) => {
    const o = typeof opts === "string" ? { message: opts } : opts || {};
    const id = ++_id;
    const ttl = o.action ? 6000 : 3500;
    setItems((x) => [...x, { id, message: o.message, tone: o.tone || "default", action: o.action, actionLabel: o.actionLabel || "Undo" }]);
    timers.current[id] = setTimeout(() => dismiss(id), ttl);
    return id;
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={{ toast, dismiss }}>
      {children}
      <div className="toastwrap">
        {items.map((t) => (
          <div className={"toast " + t.tone} key={t.id}>
            <span className="tmsg">{t.message}</span>
            {t.action && <button className="tundo" onClick={() => { t.action(); dismiss(t.id); }}>{t.actionLabel}</button>}
            <button className="tx" onClick={() => dismiss(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
