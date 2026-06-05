// Deterministic initial-avatar: hashes a name to a color, shows initials.
// Pure (no hooks) — safe in server or client components.
const COLORS = ["#6366F1", "#8B5CF6", "#14B8A6", "#F5A623", "#E5484D", "#0EA5E9", "#EC4899", "#10B981", "#F97316"];
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function initials(name) {
  const p = (name || "").trim().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return ((p[0] && p[0][0] || "") + (p[1] && p[1][0] || "")).toUpperCase() || "?";
}
export default function Avatar({ name = "", src, size = 24 }) {
  if (src) return <img className="avatar" src={src} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size }} />;
  const c = COLORS[hash(name) % COLORS.length];
  return <span className="avatar" style={{ width: size, height: size, background: c, fontSize: Math.round(size * 0.4) }}>{initials(name)}</span>;
}
