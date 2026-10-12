// One place for category names and icons so every view stays consistent.
// Colour is intentionally not per-category: the UI uses a single accent.
export const CATEGORIES = [
  { name: "Food & Groceries", short: "Food", icon: "cart" },
  { name: "Rent & Housing", short: "Housing", icon: "home" },
  { name: "Transport", short: "Transport", icon: "car" },
  { name: "Utilities", short: "Utilities", icon: "bolt" },
  { name: "Entertainment", short: "Fun", icon: "film" },
  { name: "Health", short: "Health", icon: "heart" },
  { name: "Shopping", short: "Shopping", icon: "bag" },
  { name: "Other", short: "Other", icon: "grid" },
];

const BY_NAME = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));

export const catMeta = (name) => BY_NAME[name] || BY_NAME.Other;
