// One place for category look & feel so every view colours them the same way.
export const CATEGORIES = [
  { name: "Food & Groceries", short: "Food", icon: "🛒", color: "#34d399", art: "linear-gradient(135deg, #065f46 0%, #10b981 55%, #a7f3d0 130%)" },
  { name: "Rent & Housing", short: "Housing", icon: "🏠", color: "#8b5cf6", art: "linear-gradient(135deg, #2e1065 0%, #7c3aed 55%, #c4b5fd 130%)" },
  { name: "Transport", short: "Transport", icon: "🚗", color: "#38bdf8", art: "linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 55%, #bae6fd 130%)" },
  { name: "Utilities", short: "Utilities", icon: "💡", color: "#f5b942", art: "linear-gradient(135deg, #713f12 0%, #eab308 55%, #fef08a 130%)" },
  { name: "Entertainment", short: "Fun", icon: "🎬", color: "#ff3d5a", art: "linear-gradient(135deg, #4c0519 0%, #e11d48 55%, #fda4af 130%)" },
  { name: "Health", short: "Health", icon: "💊", color: "#f472b6", art: "linear-gradient(135deg, #500724 0%, #db2777 55%, #fbcfe8 130%)" },
  { name: "Shopping", short: "Shopping", icon: "🛍️", color: "#fb923c", art: "linear-gradient(135deg, #431407 0%, #ea580c 55%, #fed7aa 130%)" },
  { name: "Other", short: "Other", icon: "📦", color: "#94a3b8", art: "linear-gradient(135deg, #0f172a 0%, #475569 55%, #cbd5e1 130%)" },
];

const BY_NAME = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));

export const catMeta = (name) => BY_NAME[name] || BY_NAME.Other;
export const catIcon = (name) => catMeta(name).icon;
export const catColor = (name) => catMeta(name).color;
