"use client";
import { Fragment, useState } from "react";
import { CatIcon } from "./Icon";
import { expenseKey, keyToDate, localDateKey, addDays, sum, euro } from "@/lib/period";

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
export default function DayGroups({ expenses, onDelete, limitDays, groups: preGrouped }) {
  const [collapsed, setCollapsed] = useState({});
  let groups = preGrouped || groupByDay(expenses);
  if (limitDays) groups = groups.slice(0, limitDays);

  const [openReceipts, setOpenReceipts] = useState({});
  const toggle = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  const toggleReceipt = (id) => setOpenReceipts((o) => ({ ...o, [id]: !o[id] }));

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
                  const open = openReceipts[exp._id];
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
                            <span className="day-item-name">{exp.item}</span>
                            <span className="day-item-cat">
                              {exp.category} · {lines.length} {lines.length === 1 ? "item" : "items"}
                              <span className={`day-item-caret ${open ? "open" : ""}`}>▾</span>
                            </span>
                          </button>
                        ) : (
                          <div className="day-item-info">
                            <span className="day-item-name">{exp.item}</span>
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
                                {it.name}
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
