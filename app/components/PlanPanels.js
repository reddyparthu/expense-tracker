"use client";
import { useState } from "react";
import Icon, { CatIcon } from "./Icon";
import Row from "./Row";
import { budgetStatus } from "@/lib/forecast";
import { keyToDate, euro } from "@/lib/period";

const prettyDate = (key) => keyToDate(key).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const dueLabel = (d) =>
  d < 0 ? `${-d} day${d === -1 ? "" : "s"} late` : d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`;

const QUALITY = {
  good: "Based on your last months",
  early: "Early estimate — gets better each month",
  rough: "Rough estimate — not much history yet",
};

// ---------- Month forecast + budgets ----------
export function ForecastPanel({ plan, budgets = {}, onSaveBudgets }) {
  const { forecast, suggestedBudgets } = plan;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const monthName = keyToDate(`${forecast.month}-01`).toLocaleDateString("en-GB", { month: "long" });
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
  // Only show a budget total when every category in the forecast has one
  const budgetedCount = forecast.rows.filter((r) => budgets[r.category]).length;
  const fullBudget = budgetedCount > 0 && budgetedCount === forecast.rows.length;
  const scale = Math.max(1, ...forecast.rows.map((r) => Math.max(r.forecast, budgets[r.category] || 0, r.usual || 0)));

  const startEdit = () => {
    setDraft(Object.fromEntries(forecast.rows.map((r) => [r.category, budgets[r.category] ?? ""])));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const clean = Object.fromEntries(
      Object.entries(draft)
        .map(([c, v]) => [c, parseFloat(String(v).replace(",", "."))])
        .filter(([, v]) => v > 0)
    );
    try {
      await onSaveBudgets?.(clean);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!forecast.rows.length) {
    return (
      <div className="panel">
        <h3 className="panel-title">{monthName} forecast</h3>
        <p className="no-data">Add a few expenses and a forecast will appear here.</p>
      </div>
    );
  }

  return (
    <div className="panel forecast">
      <div className="forecast-head">
        <div>
          <h3 className="panel-title">{monthName} forecast</h3>
          <p className="insight-note">
            {QUALITY[forecast.quality]} · day {forecast.elapsed} of {forecast.daysInMonth}
          </p>
        </div>
        {!editing ? (
          <button className="btn btn-ghost btn-small" onClick={startEdit}>
            {totalBudget ? "Edit budgets" : "Set budgets"}
          </button>
        ) : (
          <div className="forecast-actions">
            <button
              className="btn btn-ghost btn-small"
              onClick={() =>
                setDraft((d) =>
                  Object.fromEntries(Object.keys(d).map((c) => [c, suggestedBudgets[c] ?? d[c] ?? ""]))
                )
              }
            >
              Use suggestions
            </button>
            <button className="btn btn-primary btn-small" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="forecast-totals">
        <div>
          <span className="modal-stat-label">Spent</span>
          <span className="forecast-big">{euro(forecast.spent)}</span>
        </div>
        <div>
          <span className="modal-stat-label">Expected by month end</span>
          <span className="forecast-big accent">{euro(forecast.forecast)}</span>
        </div>
        <div>
          <span className="modal-stat-label">{fullBudget ? "Budget" : "Usual month"}</span>
          <span className="forecast-big">
            {fullBudget ? euro(totalBudget) : forecast.usual !== null ? euro(forecast.usual) : "—"}
          </span>
          {!fullBudget && budgetedCount > 0 && (
            <span className="fc-sub left">
              Budgets set for {budgetedCount} of {forecast.rows.length} categories
            </span>
          )}
        </div>
      </div>

      <div className="forecast-rows">
        {forecast.rows.map((r) => {
          const budget = budgets[r.category];
          const status = budgetStatus(r, budget);
          return (
            <div key={r.category} className="fc-row">
              <div className="fc-label">
                <span className="fc-icon">
                  <CatIcon name={r.category} size={16} />
                </span>
                <span className="fc-name">{r.category}</span>
                {status && !editing && <span className={`fc-status ${status.state}`}>{status.label}</span>}
              </div>

              <div className="fc-bar" title={`Spent ${euro(r.spent)} · expected ${euro(r.forecast)}`}>
                <span className="fc-forecast" style={{ width: `${(r.forecast / scale) * 100}%` }} />
                <span className={`fc-spent ${status?.state || ""}`} style={{ width: `${(r.spent / scale) * 100}%` }} />
                {budget ? <span className="fc-budget" style={{ left: `${(budget / scale) * 100}%` }} /> : null}
                {!budget && r.usual ? <span className="fc-usual" style={{ left: `${(r.usual / scale) * 100}%` }} /> : null}
              </div>

              <div className="fc-values">
                {editing ? (
                  <label className="fc-input">
                    €
                    <input
                      inputMode="decimal"
                      value={draft[r.category] ?? ""}
                      placeholder={suggestedBudgets[r.category] ? String(suggestedBudgets[r.category]) : "—"}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.category]: e.target.value }))}
                    />
                  </label>
                ) : (
                  <>
                    <span className="fc-main">
                      {euro(r.spent)} <span className="fc-arrow">→</span> {euro(r.forecast)}
                    </span>
                    <span className="fc-sub">
                      {budget ? `of ${euro(budget)}` : r.usual !== null ? `usual ${euro(r.usual)}` : "new this month"}
                      {r.billsDue.length ? ` · ${r.billsDue.length} bill${r.billsDue.length > 1 ? "s" : ""} to come` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fc-legend">
        <span>
          <i className="lg-spent" /> Spent
        </span>
        <span>
          <i className="lg-forecast" /> Expected
        </span>
        <span>
          <i className="lg-mark" /> {totalBudget ? "Budget / usual" : "Usual"}
        </span>
      </div>
    </div>
  );
}

// ---------- Regular bills ----------
export function RecurringPanel({ plan }) {
  const { recurring, subscriptionsPerMonth } = plan;
  return (
    <div className="panel">
      <h3 className="panel-title">Regular bills</h3>
      {recurring.length ? (
        <>
          <p className="insight-note">
            {recurring.length} found automatically · about {euro(subscriptionsPerMonth)} a month
          </p>
          <div className="recent-list">
            {recurring.map((r) => (
              <div key={r.key} className="recent-item">
                <div className="recent-info">
                  <span className="recent-name">
                    <CatIcon name={r.category} size={16} /> {r.name}
                  </span>
                  <span className="recent-cat">
                    {r.intervalLabel} · next {prettyDate(r.next)}
                    {r.confidence === "low" ? " · likely" : ""}
                  </span>
                </div>
                <div className="bill-right">
                  <span className="recent-amount">{euro(r.amount)}</span>
                  <span className={`bill-due ${r.dueIn < 0 ? "late" : r.dueIn <= 3 ? "soon" : ""}`}>{dueLabel(r.dueIn)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="no-data">
          Nothing regular yet. Subscriptions and bills show up here after they&apos;ve been logged a couple of times.
        </p>
      )}
    </div>
  );
}

// ---------- Alerts ----------
const ALERT_ICON = { unusual: "trend", duplicate: "clipboard", budget: "chart", trend: "trend", bill: "calendar" };

export function AlertsPanel({ alerts, limit, title = "Heads up", compact = false }) {
  const [showAll, setShowAll] = useState(false);
  const list = limit && !showAll ? alerts.slice(0, limit) : alerts;
  if (!alerts.length) {
    if (compact) return null;
    return (
      <div className="panel">
        <h3 className="panel-title">{title}</h3>
        <p className="no-data">All quiet — nothing unusual right now.</p>
      </div>
    );
  }
  return (
    <div className={`panel alerts ${compact ? "compact" : ""}`}>
      <h3 className="panel-title">{title}</h3>
      <div className="alert-list">
        {list.map((a) => (
          <div key={a.id} className={`alert sev-${a.severity}`}>
            <span className="alert-icon">
              <Icon name={ALERT_ICON[a.kind] || "search"} size={16} />
            </span>
            <div className="alert-body">
              <span className="alert-title">{a.title}</span>
              <span className="alert-text">{a.text}</span>
            </div>
          </div>
        ))}
      </div>
      {limit && alerts.length > limit && (
        <button className="alert-more" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show less" : `Show ${alerts.length - limit} more`}
        </button>
      )}
    </div>
  );
}

// ---------- Home: bills coming up ----------
export function UpcomingRow({ recurring }) {
  const soon = recurring.filter((r) => r.dueIn >= -5 && r.dueIn <= 14);
  if (!soon.length) return null;
  return (
    <Row title="Coming up" meta={`${soon.length} bill${soon.length > 1 ? "s" : ""} in the next 2 weeks`}>
      {soon.map((r) => (
        <div key={r.key} className="tile bill-tile">
          <span className="cat-tile-badge">
            <CatIcon name={r.category} size={18} />
          </span>
          <span className={`bill-due ${r.dueIn < 0 ? "late" : r.dueIn <= 3 ? "soon" : ""}`}>{dueLabel(r.dueIn)}</span>
          <span className="bill-tile-body">
            <span className="bill-tile-name">{r.name}</span>
            <span className="bill-tile-amount">{euro(r.amount)}</span>
            <span className="bill-tile-sub">
              {r.intervalLabel} · {prettyDate(r.next)}
            </span>
          </span>
        </div>
      ))}
    </Row>
  );
}
