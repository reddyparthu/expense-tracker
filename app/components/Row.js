"use client";
import { useEffect, useRef, useState } from "react";

// Netflix-style horizontal row: snap-scrolling track with edge arrows on desktop.
export default function Row({ title, meta, children }) {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  const page = (dir) => {
    const el = trackRef.current;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="row">
      <div className="row-head">
        <h2 className="row-title">{title}</h2>
        {meta && <span className="row-meta">{meta}</span>}
      </div>
      <div className="row-viewport">
        {edges.left && (
          <button className="row-arrow left" onClick={() => page(-1)} aria-label="Scroll left">
            ‹
          </button>
        )}
        <div className="row-track" ref={trackRef} data-noswipe>
          <div className="row-items">{children}</div>
        </div>
        {edges.right && (
          <button className="row-arrow right" onClick={() => page(1)} aria-label="Scroll right">
            ›
          </button>
        )}
      </div>
    </section>
  );
}
