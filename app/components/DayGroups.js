"use client";
import { Fragment, useState } from "react";
import { CatIcon } from "./Icon";
import { expenseKey, keyToDate, localDateKey, addDays, sum, euro } from "@/lib/period";
import { fold } from "@/lib/search";

// Wraps the parts of `text` that match any search term in <mark> (case/accent-insensitive)
function Highlight({ text, terms }) {
  const str = String(text ?? "");
  if (!terms?.length) return str;
  const folded = fold(str);
  if (folded.length !== str.length) return str; // unusual characters: skip rather than mis-highlight
  const ranges = [];
  for (const t of terms) {
    let i = folded.indexOf(t);
    while (t && i !== -1) {
      ranges.push([i, i + t.length]);
      i = folded.indexOf(t, i + t.length);
    }
  }
  if (!ranges.length) return str;
  ranges.sort((a, b) => a[0] - b[0]);
  const parts = [];
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start < pos) continue;
    if (start > pos) parts.push(str.slice(pos, start));
    parts.push(<mark key={start}>{str.slice(start, end)}</mark>);
    pos = end;
  }
  parts.push(str.slice(pos));
  return parts;
}

// Group expenses by day, newest day first. Within a day, keep incoming order.
export function groupByDay(expenses) {
  const map = new Map();
  for (const e of expenses) {
    const k = expenseKey(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({ key, items, total: sum(items) }));
}

export function dayHeading(key) {
  const today = localDateKey();
  const yesterday = localDateKey(addDays(new Date(), -1));
  const d = keyToDate(key);
  const full = d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
  if (key === today) return { title: "Today", sub: full };
  if (key === yesterday) return { title: "Yesterday", sub: full };
  return { title: full, sub: null };
}

// Expenses shown as sub-blocks under a header for each date.
// Days can be collapsed. `limitDays` caps how many day groups render.
// `highlight`: search terms to mark. `openIds`: receipts to show expanded (e.g. their items matched a search).
export default function DayGroups({ expenses, onDelete, limitDays, groups: preGrouped, highlight = null, openIds = null }) {
  const [collapsed, setCollapsed] = useState({});
  let groups = preGrouped || groupByDay(expenses);
  if (limitDays) groups = groups.slice(0, limitDays);

  const [openReceipts, setOpenReceipts] = useState({});
  const toggle = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  const isOpen = (id) => openReceipts[id] ?? Boolean(openIds?.has(id));
  const toggleReceipt = (id) => setOpenReceipts((o) => ({ ...o, [id]: !(o[id] ?? Boolean(openIds?.has(id))) }));

  return (
    <div className="day-groups">
      {groups.map(({ key, items, total }) => {
        const { title, sub } = dayHeading(key);
        const isCollapsed = collapsed[key];
        return (
          <section key={key} className="day-group">
            <button className="day-header" onClick={() => toggle(key)} aria-expanded={!isCollapsed}>
              <div className="day-header-left">
                <span className={`day-chevron ${isCollapsed ? "collapsed" : ""}`}>▾</span>
                <div className="day-title-wrap">
                  <span className="day-title">{title}</span>
                  {sub && <span className="day-sub">{sub}</span>}
                </div>
              </div>
              <div className="day-header-right">
                <span className="day-count">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
                <span className="day-total">{euro(total)}</span>
              </div>
            </button>

            {!isCollapsed && (
              <div className="day-items">
                {items.map((exp) => {
                  const lines = exp.items || [];
                  const open = isOpen(exp._id);
                  return (
                    <Fragment key={exp._id}>
                      <div className="day-item">
                        <span className="day-item-icon">
                          <CatIcon name={exp.category} />
                        </span>
                        {lines.length ? (
                          <button
                            className="day-item-info as-button"
                            onClick={() => toggleReceipt(exp._id)}
                            aria-expanded={Boolean(open)}
                          >
                            <span className="day-item-name">
                              <Highlight text={exp.item} terms={highlight} />
                            </span>
                            <span className="day-item-cat">
                              {exp.category} · {lines.length} {lines.length === 1 ? "item" : "items"}
                              <span className={`day-item-caret ${open ? "open" : ""}`}>▾</span>
                            </span>
                          </button>
                        ) : (
                          <div className="day-item-info">
                            <span className="day-item-name">
                              <Highlight text={exp.item} terms={highlight} />
                            </span>
                            <span className="day-item-cat">{exp.category}</span>
                          </div>
                        )}
                        <span className="day-item-amount">{euro(exp.amount)}</span>
                        {onDelete && (
                          <button className="delete-btn" onClick={() => onDelete(exp._id)} title="Delete">
                            ✕
                          </button>
                        )}
                      </div>
                      {open && (
                        <div className="day-subitems">
                          {lines.map((it, i) => (
                            <div key={i} className="day-subitem">
                              <span className="day-subitem-name">
                                {it.qty > 1 && !it.isWeight ? `${it.qty}× ` : ""}
                                <Highlight text={it.name} terms={highlight} />
                                {it.isWeight ? ` · ${it.qty} kg` : ""}
                              </span>
                              <span className="day-subitem-amount">{euro(Number(it.amount))}</span>
                            </div>
                          ))}
                          {exp.adjustment ? (
                            <div className="day-subitem muted">
                              <span className="day-subitem-name">Balance to receipt total</span>
                              <span className="day-subitem-amount">{euro(exp.adjustment)}</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
