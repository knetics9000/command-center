// Tiny zero-dependency line-icon set (Lucide-style). Inherits currentColor.
const P = {
  sparkle: "M12 3l1.9 4.6L18.5 9.5 14 11.4 12 16l-2-4.6L5.5 9.5 10.1 7.6z",
  target: "", // drawn with circles below
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  reply: "M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v2",
  clock: "M12 7v5l3 2",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.4 5h13.2a2 2 0 0 1 1.8 1.2L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l1.6-5.8A2 2 0 0 1 5.4 5z",
  check: "M20 6L9 17l-5-5",
};

export default function Icon({ name, size = 16, className = "", strokeWidth = 2 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", className: "ic " + className, "aria-hidden": true };
  if (name === "target")
    return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
  if (name === "clock")
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d={P.clock} /></svg>;
  if (name === "sparkle")
    return <svg {...common} fill="currentColor" stroke="none"><path d={P.sparkle} /></svg>;
  return <svg {...common}><path d={P[name] || ""} /></svg>;
}
