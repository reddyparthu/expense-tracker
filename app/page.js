"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import LoginScreen from "./components/LoginScreen";
import NavBar from "./components/NavBar";
import FluidBackground from "./components/FluidBackground";
import ExpenseForm from "./components/ExpenseForm";
import Dashboard from "./components/Dashboard";
import ExpenseList from "./components/ExpenseList";
import BillScanner from "./components/BillScanner";
import Insights from "./components/Insights";

export default function Home() {
  const { data: session, status } = useSession();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  // Shared by Dashboard and History so swiping to a past period sticks across tabs
  const [period, setPeriod] = useState(() => ({ mode: "month", anchor: new Date(), dir: 0 }));

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (status === "loading" || (session && loading)) {
    return (
      <div className="loading-screen">
        <FluidBackground />
        <div className="loader">
          <span className="logo-mark big">S</span>
          <span className="loader-bar" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  const PAGES = {
    add: { eyebrow: "New entry", title: "Add Expense" },
    scan: { eyebrow: "Smart capture", title: "Scan a Bill" },
    history: { eyebrow: "Your timeline", title: "History" },
    insights: { eyebrow: "Deep dive", title: "Insights" },
  };
  const pageInfo = PAGES[activeTab];

  return (
    <div className="app">
      <FluidBackground />
      <NavBar active={activeTab} onChange={handleTabChange} user={session.user} />

      <main className={`main ${activeTab === "dashboard" ? "is-home" : ""}`}>
        {pageInfo && (
          <header className="page-head">
            <span className="eyebrow">{pageInfo.eyebrow}</span>
            <h1 className="page-title">{pageInfo.title}</h1>
          </header>
        )}

        <div className="page-body" key={activeTab}>
          {activeTab === "dashboard" && (
            <Dashboard
              expenses={expenses}
              period={period}
              onPeriodChange={setPeriod}
              onNavigate={handleTabChange}
              onDelete={handleDelete}
            />
          )}
          {activeTab === "add" && <ExpenseForm onExpenseAdded={() => fetchExpenses()} />}
          {activeTab === "scan" && <BillScanner expenses={expenses} onExpenseAdded={() => fetchExpenses()} />}
          {activeTab === "history" && (
            <ExpenseList
              expenses={expenses}
              onDelete={handleDelete}
              period={period}
              onPeriodChange={setPeriod}
            />
          )}
          {activeTab === "insights" && <Insights expenses={expenses} />}
        </div>
      </main>
    </div>
  );
}
