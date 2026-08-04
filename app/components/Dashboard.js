"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

const COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#6b7280",
];

export default function Dashboard({ expenses }) {
  const now = new Date();

  // --- Today ---
  const todayStr = now.toISOString().split("T")[0];
  const todayExpenses = expenses.filter(
    (e) => new Date(e.date).toISOString().split("T")[0] === todayStr
  );
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // --- Weekly ---
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const weeklyExpenses = expenses.filter((e) => new Date(e.date) >= startOfWeek);
  const weeklyTotal = weeklyExpenses.reduce((sum, e) => sum + e.amount, 0);

  // --- Monthly ---
  const monthlyExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

  // --- All time ---
  const allTimeTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  // --- Category breakdown ---
  const categoryMap = {};
  monthlyExpenses.forEach((e) => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
  });
  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }))
    .sort((a, b) => b.value - a.value);

  // --- Daily spending this week ---
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dailyData = dayNames.map((name, index) => {
    const dayExpenses = weeklyExpenses.filter(
      (e) => new Date(e.date).getDay() === index
    );
    return {
      name,
      amount: Math.round(dayExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
    };
  });

  // --- Last 30 days trend ---
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayTotal = expenses
      .filter((e) => new Date(e.date).toISOString().split("T")[0] === dateStr)
      .reduce((sum, e) => sum + e.amount, 0);
    last30.push({
      date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
      amount: Math.round(dayTotal * 100) / 100,
    });
  }

  // --- Top spending categories ---
  const topCategories = categoryData.slice(0, 4);

  // --- Recent expenses ---
  const recent = expenses.slice(0, 5);

  return (
    <div className="dashboard">
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card today-card">
          <span className="summary-icon">📅</span>
          <div className="summary-text">
            <span className="summary-label">Today</span>
            <span className="summary-amount">€{todayTotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="summary-card weekly-card">
          <span className="summary-icon">📆</span>
          <div className="summary-text">
            <span className="summary-label">This Week</span>
            <span className="summary-amount">€{weeklyTotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="summary-card monthly-card">
          <span className="summary-icon">🗓️</span>
          <div className="summary-text">
            <span className="summary-label">This Month</span>
            <span className="summary-amount">€{monthlyTotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="summary-card total-card">
          <span className="summary-icon">💰</span>
          <div className="summary-text">
            <span className="summary-label">All Time</span>
            <span className="summary-amount">€{allTimeTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Daily Spending This Week</h3>
          {weeklyExpenses.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`€${value}`, "Spent"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="no-data">No expenses this week</p>
          )}
        </div>

        <div className="chart-card">
          <h3>Monthly by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  dataKey="value"
                  paddingAngle={3}
                  label={({ name, percent }) =>
                    `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={true}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `€${value}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="no-data">No expenses this month</p>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <div className="chart-card full-width">
        <h3>30-Day Spending Trend</h3>
        {expenses.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={last30}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval={6}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`€${value}`, "Spent"]}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#colorAmount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="no-data">Add expenses to see your trend</p>
        )}
      </div>

      {/* Bottom Row */}
      <div className="bottom-grid">
        {/* Top Categories */}
        <div className="card">
          <h3>Top Categories</h3>
          {topCategories.length > 0 ? (
            <div className="top-categories">
              {topCategories.map((cat, i) => (
                <div key={cat.name} className="top-cat-item">
                  <div className="top-cat-info">
                    <div
                      className="top-cat-dot"
                      style={{ background: COLORS[i] }}
                    ></div>
                    <span className="top-cat-name">{cat.name}</span>
                  </div>
                  <div className="top-cat-right">
                    <span className="top-cat-amount">€{cat.value.toFixed(2)}</span>
                    <div className="top-cat-bar-bg">
                      <div
                        className="top-cat-bar-fill"
                        style={{
                          width: `${(cat.value / categoryData[0].value) * 100}%`,
                          background: COLORS[i],
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No data yet</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3>Recent Activity</h3>
          {recent.length > 0 ? (
            <div className="recent-list">
              {recent.map((exp) => (
                <div key={exp._id} className="recent-item">
                  <div className="recent-info">
                    <span className="recent-name">{exp.item}</span>
                    <span className="recent-cat">{exp.category}</span>
                  </div>
                  <span className="recent-amount">€{exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No expenses yet</p>
          )}
        </div>
      </div>
    </div>
  );
}