// Pure tag helpers — safe to import from client components (no DB import).
export function tagsOf(tagStr) {
  return (tagStr || "").split(";").map((t) => t.trim()).filter(Boolean);
}
export function tagClass(t) {
  const l = (t || "").toLowerCase();
  if (l === "personal") return "personal";
  if (l === "work") return "work";
  if (/project/.test(l)) return "project";
  return "";
}
