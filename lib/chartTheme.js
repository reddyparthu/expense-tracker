// Shared Recharts styling. CSS variables work in inline styles, so charts follow the theme.
export const ACCENT = "#ff3d5a";
export const ACCENT_SOFT = "rgba(255, 61, 90, 0.35)";

export const tooltipProps = {
  contentStyle: {
    background: "var(--surface-solid)",
    border: "1px solid var(--border-strong)",
    borderRadius: 12,
    fontSize: 13,
    color: "var(--text)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  },
  labelStyle: { color: "var(--text-muted)", marginBottom: 2 },
  itemStyle: { color: "var(--text)" },
  cursor: { fill: "var(--surface-2)" },
};

export const axisProps = {
  tick: { fontSize: 11, fill: "var(--text-dim)" },
  axisLine: false,
  tickLine: false,
};
