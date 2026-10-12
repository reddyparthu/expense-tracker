"use client";
import { useEffect, useRef } from "react";

// Animated fluid gradient. Drawn on a tiny canvas (≈1/10 of the screen) and
// stretched with CSS, which keeps it soft and very cheap. One blob trails the
// pointer/finger so the background reacts to touch.
const BLOBS = [
  { x: 0.15, y: 0.1, r: 0.55, ax: 0.12, ay: 0.08, s: 0.00011, p: 0, c: 1 },
  { x: 0.85, y: 0.2, r: 0.5, ax: 0.1, ay: 0.12, s: 0.00009, p: 2, c: 2 },
  { x: 0.7, y: 0.85, r: 0.6, ax: 0.14, ay: 0.08, s: 0.00008, p: 4, c: 3 },
  { x: 0.2, y: 0.75, r: 0.45, ax: 0.1, ay: 0.1, s: 0.00012, p: 1, c: 4 },
];

function readPalette() {
  const s = getComputedStyle(document.documentElement);
  return {
    colors: [1, 2, 3, 4, 5].map((i) => s.getPropertyValue(`--fluid-${i}`).trim() || "#ff3d5a"),
    alpha: parseFloat(s.getPropertyValue("--fluid-alpha")) || 0.4,
    blend: s.getPropertyValue("--fluid-blend").trim() || "lighter",
  };
}

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export default function FluidBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const SCALE = 0.1;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let palette = readPalette();

    const resize = () => {
      w = canvas.width = Math.max(32, Math.ceil(window.innerWidth * SCALE));
      h = canvas.height = Math.max(32, Math.ceil(window.innerHeight * SCALE));
    };

    const pointer = { x: 0.5, y: 0.35, tx: 0.5, ty: 0.35 };
    const onMove = (e) => {
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = e.clientY / window.innerHeight;
    };

    const blob = (x, y, r, hex, a) => {
      const [R, G, B] = hexToRgb(hex);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${R},${G},${B},${a})`);
      g.addColorStop(0.55, `rgba(${R},${G},${B},${a * 0.35})`);
      g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const draw = (t) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = palette.blend;
      const m = Math.max(w, h);
      for (const b of BLOBS) {
        const x = (b.x + Math.sin(t * b.s + b.p) * b.ax) * w;
        const y = (b.y + Math.cos(t * b.s * 1.3 + b.p) * b.ay) * h;
        blob(x, y, b.r * m, palette.colors[b.c - 1], palette.alpha);
      }
      pointer.x += (pointer.tx - pointer.x) * 0.035;
      pointer.y += (pointer.ty - pointer.y) * 0.035;
      blob(pointer.x * w, pointer.y * h, 0.32 * m, palette.colors[4], palette.alpha * 0.9);
    };

    const loop = (t) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduceMotion) draw(0);
      else raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    };

    // Re-read colours when the theme flips
    const themeObserver = new MutationObserver(() => {
      palette = readPalette();
      if (reduceMotion) draw(0);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    resize();
    start();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="fluid-wrap" aria-hidden="true">
      <canvas ref={ref} className="fluid-canvas" />
      <div className="fluid-grain" />
      <div className="fluid-vignette" />
    </div>
  );
}
