"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import DayGroups from "./DayGroups";
import { sum, euro } from "@/lib/period";

// "More info" overlay: a hero banner plus that slice of expenses grouped by day.
// detail = { eyebrow, title, subtitle, icon, match(expense) }
// Filtering happens here so deletes made inside the modal show up immediately.
export default function DetailModal({ detail, expenses: all, onClose, onDelete }) {
  useEffect(() => {
    if (!detail) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [detail, onClose]);

  if (!detail) return null;
  const { eyebrow, title, subtitle, icon, match } = detail;
  const expenses = all.filter(match);
  const total = sum(expenses);
  const biggest = expenses.reduce((m, e) => (!m || e.amount > m.amount ? e : m), null);

  // Portal to <body> so the overlay sits above the fixed nav bars
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-hero">
          {icon && <span className="modal-hero-icon">{icon}</span>}
          <div className="modal-hero-fade" />
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="modal-hero-content">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-stats">
            <div className="modal-stat">
              <span className="modal-stat-label">Total</span>
              <span className="modal-stat-value">{euro(total)}</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-label">Expenses</span>
              <span className="modal-stat-value">{expenses.length}</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-label">Biggest</span>
              <span className="modal-stat-value">{biggest ? euro(biggest.amount) : "—"}</span>
            </div>
          </div>

          {expenses.length ? (
            <DayGroups expenses={expenses} onDelete={onDelete} />
          ) : (
            <p className="no-data">Nothing here yet</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
