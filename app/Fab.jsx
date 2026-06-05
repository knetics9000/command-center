"use client";
export default function Fab() {
  return (
    <button className="fab" title="Quick add (⌘K)" onClick={() => window.dispatchEvent(new Event("cc:cmdk"))}>
      <span className="material-symbols-outlined">add</span>
    </button>
  );
}
