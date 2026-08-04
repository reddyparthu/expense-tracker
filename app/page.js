"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import LoginScreen from "./components/LoginScreen";
import Sidebar from "./components/Sidebar";
import ExpenseForm from "./components/ExpenseForm";
import Dashboard from "./components/Dashboard";
import ExpenseList from "./components/ExpenseList";
import BillScanner from "./components/BillScanner";

export default function Home() {
  const { data: session, status } = useSession();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchExpenses = async () => {
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchExpenses();
    } else {
      setLoading(false);
    }
  }, [session]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      fetchExpenses();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  if (status === "loading" || (session && loading)) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading SpendWise...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const stats = {
    today: expenses
      .filter((e) => new Date(e.date).toISOString().split("T")[0] === todayStr)
      .reduce((sum, e) => sum + e.amount, 0),
    monthly: expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + e.amount, 0),
    totalEntries: expenses.length,
  };

  return (
    <div className="app-layout">
      <header className="mobile-header">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          ☰
        </button>
        <span className="mobile-title">💰 SpendWise</span>
      </header>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`sidebar-wrapper ${sidebarOpen ? "open" : ""}`}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          stats={stats}
          user={session.user}
        />
      </div>

      <main className="main-content">
        <div className="content-header">
          <h1 className="page-title">
            {activeTab === "dashboard" && "Dashboard"}
            {activeTab === "add" && "Add Expense"}
            {activeTab === "scan" && "Scan Bill"}
            {activeTab === "history" && "History"}
          </h1>
        </div>

        <div className="content-body">
          {activeTab === "dashboard" && <Dashboard expenses={expenses} />}
          {activeTab === "add" && (
            <ExpenseForm onExpenseAdded={() => fetchExpenses()} />
          )}
          {activeTab === "scan" && (
            <BillScanner onExpenseAdded={() => fetchExpenses()} />
          )}
          {activeTab === "history" && (
            <ExpenseList expenses={expenses} onDelete={handleDelete} />
          )}
        </div>
      </main>
    </div>
  );
}