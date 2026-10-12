"use client";
import { useRef } from "react";
import { MODES, getRange, shiftAnchor, isCurrentPeriod } from "@/lib/period";

// Controlled picker: { mode, anchor } lives in the parent so Dashboard and
// History share the same period.
export default function PeriodPicker({ period, onChange, modes = MODES }) {
  const { mode, anchor } = period;
  const range = getRange(mode, anchor);
  const atCurrent = isCurrentPeriod(mode, anchor);

  const go = (dir) => {
    if (mode === "all") return;
    if (dir > 0 && atCurrent) return;
    onChange({ mode, anchor: shiftAnchor(mode, anchor, dir), dir });
  };

  return (
    <div className="period-picker">
      <div className="period-modes">
        {modes.map((m) => (
          <button
            key={m.id}
            className={`period-mode ${mode === m.id ? "active" : ""}`}
            onClick={() => onChange({ mode: m.id, anchor: new Date(), dir: 0 })}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode !== "all" && (
        <div className="period-nav">
          <button className="period-arrow" onClick={() => go(-1)} aria-label="Previous period">
            ‹
          </button>
          <span className="period-label">{range.label}</span>
          <button
            className="period-arrow"
            onClick={() => go(1)}
            disabled={atCurrent}
            aria-label="Next period"
          >
            ›
          </button>
        </div>
      )}
      {mode !== "all" && <p className="period-hint">Swipe right for earlier, left for later</p>}
    </div>
  );
}

// Wraps content so a horizontal swipe moves the period.
// Swipe right (finger moves left→right) = previous period, like turning back a page.
export function SwipeArea({ period, onChange, children }) {
  const start = useRef(null);
  const { mode, anchor, dir = 0 } = period;

  const onTouchStart = (e) => {
    // Horizontal rows scroll on their own; don't treat that as a period swipe
    if (e.target.closest("[data-noswipe]")) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e) => {
    if (!start.current || mode === "all") return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const step = dx > 0 ? -1 : 1;
    if (step > 0 && isCurrentPeriod(mode, anchor)) return;
    onChange({ mode, anchor: shiftAnchor(mode, anchor, step), dir: step });
  };

  const range = getRange(mode, anchor);
  const animClass = dir < 0 ? "slide-from-left" : dir > 0 ? "slide-from-right" : "";

  return (
    <div className="swipe-area" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div key={`${mode}-${range.start}`} className={animClass}>
        {children}
      </div>
    </div>
  );
}
