"use client";
import { useSyncExternalStore } from "react";

// The theme attribute is set before first paint by a script in layout.js,
// so we just mirror <html data-theme> here.
const subscribe = (cb) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
};
const getTheme = () => document.documentElement.getAttribute("data-theme") || "dark";

export default function ThemeToggle({ withLabel = false }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark");
  const dark = theme === "dark";

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return (
    <button className={`theme-toggle ${withLabel ? "with-label" : ""}`} onClick={toggle} title="Toggle theme">
      <span className="theme-toggle-icon">{dark ? "☀" : "☾"}</span>
      {withLabel && <span>{dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
