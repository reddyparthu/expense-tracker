"use client";
import { signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "add", label: "Add Expense", icon: "✏️" },
  { id: "scan", label: "Scan Bill", icon: "📷" },
  { id: "history", label: "History", icon: "📋" },
];

export default function Sidebar({ activeTab, onTabChange, stats, user }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top-row">
        <div className="sidebar-logo">
          <span className="logo-icon">💰</span>
          <span className="logo-text">SpendWise</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="sidebar-user">
        {user?.image && (
          <img src={user.image} alt="" className="user-avatar" />
        )}
        <div className="user-info">
          <span className="user-name">{user?.name || "User"}</span>
          <span className="user-email">{user?.email || ""}</span>
        </div>
      </div>

      <div className="sidebar-stats">
        <div className="stat-mini">
          <span className="stat-mini-label">This Month</span>
          <span className="stat-mini-value">€{stats.monthly.toFixed(2)}</span>
        </div>
        <div className="stat-mini">
          <span className="stat-mini-label">Today</span>
          <span className="stat-mini-value">€{stats.today.toFixed(2)}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-btn ${activeTab === item.id ? "active" : ""}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="sidebar-btn-icon">{item.icon}</span>
            <span className="sidebar-btn-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-entries">
          <span>{stats.totalEntries} expenses tracked</span>
        </div>
        <button className="signout-btn" onClick={() => signOut()}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}