(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/components/Dashboard [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Dashboard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$BarChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/chart/BarChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/Bar.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/XAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/YAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/component/Tooltip.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/component/ResponsiveContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$PieChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/chart/PieChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$Pie$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/polar/Pie.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Cell$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/component/Cell.js [app-client] (ecmascript)");
"use client";
;
const COLORS = [
    "#4f46e5",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#6b7280"
];
function Dashboard({ expenses }) {
    const now = new Date();
    // --- Weekly total ---
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weeklyExpenses = expenses.filter((e)=>new Date(e.date) >= startOfWeek);
    const weeklyTotal = weeklyExpenses.reduce((sum, e)=>sum + e.amount, 0);
    // --- Monthly total ---
    const monthlyExpenses = expenses.filter((e)=>{
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthlyTotal = monthlyExpenses.reduce((sum, e)=>sum + e.amount, 0);
    // --- Total all time ---
    const allTimeTotal = expenses.reduce((sum, e)=>sum + e.amount, 0);
    // --- Category breakdown (for pie chart) ---
    const categoryMap = {};
    monthlyExpenses.forEach((e)=>{
        categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });
    const categoryData = Object.entries(categoryMap).map(([name, value])=>({
            name,
            value: Math.round(value * 100) / 100
        }));
    // --- Daily spending this week (for bar chart) ---
    const dayNames = [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat"
    ];
    const dailyData = dayNames.map((name, index)=>{
        const dayExpenses = weeklyExpenses.filter((e)=>new Date(e.date).getDay() === index);
        return {
            name,
            amount: Math.round(dayExpenses.reduce((sum, e)=>sum + e.amount, 0) * 100) / 100
        };
    });
    return <div className="dashboard">
      { /* Summary Cards */ }
      <div className="summary-cards">
        <div className="summary-card weekly">
          <span className="summary-label">This Week</span>
          <span className="summary-amount">€{weeklyTotal.toFixed(2)}</span>
        </div>
        <div className="summary-card monthly">
          <span className="summary-label">This Month</span>
          <span className="summary-amount">€{monthlyTotal.toFixed(2)}</span>
        </div>
        <div className="summary-card total">
          <span className="summary-label">All Time</span>
          <span className="summary-amount">€{allTimeTotal.toFixed(2)}</span>
        </div>
      </div>

      { /* Charts */ }
      <div className="charts-grid">
        { /* Bar Chart - Daily Spending */ }
        <div className="chart-card">
          <h3>Daily Spending This Week</h3>
          {weeklyExpenses.length > 0 ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"] : <p className="no-data">No expenses this week</p>}
        </div>

        { /* Pie Chart - Category Breakdown */ }
        <div className="chart-card">
          <h3>Monthly by Category</h3>
          {categoryData.length > 0 ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"] : <p className="no-data">No expenses this month</p>}
        </div>
      </div>
    </div>;
}
}),
"[project]/app/components/ExpenseForm [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ExpenseForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
"use client";
;
const categories = [
    "Food & Groceries",
    "Rent & Housing",
    "Transport",
    "Utilities",
    "Entertainment",
    "Health",
    "Shopping",
    "Other"
];
function ExpenseForm({ onExpenseAdded }) {
    const [form1, setForm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        item: "",
        amount: "",
        category: "Food & Groceries",
        date: new Date().toISOString().split("T")[0]
    });
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const handleSubmit = async (e)=>{
        e.preventDefault();
        setLoading(true);
        setMessage("");
        try {
            const res = await fetch("/api/expenses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(form1)
            });
            if (res.ok) {
                setMessage("Expense added!");
                setForm({
                    item: "",
                    amount: "",
                    category: "Food & Groceries",
                    date: new Date().toISOString().split("T")[0]
                });
                if (onExpenseAdded) onExpenseAdded();
                setTimeout(()=>setMessage(""), 2000);
            } else {
                setMessage("Failed to add expense");
            }
        } catch (err) {
            setMessage("Something went wrong");
        } finally{
            setLoading(false);
        }
    };
    return <div className="expense-form-card">
      <h2>Add Expense</h2>

      {message && <div className={`form-message ${message.includes("added") ? "success" : "error"}`}>
          {message}
        </div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>What did you spend on?</label>
          <input type="text" placeholder="e.g. Rice, Bus ticket, Netflix" value={form1.item} onChange={(e)=>setForm({
            ...form1,
            item: e.target.value
        })} required/>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Amount (€)</label>
            <input type="number" placeholder="0.00" step="0.01" min="0" value={form1.amount} onChange={(e)=>setForm({
            ...form1,
            amount: e.target.value
        })} required/>
          </div>

          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form1.date} onChange={(e)=>setForm({
            ...form1,
            date: e.target.value
        })} required/>
          </div>
        </div>

        <div className="form-group">
          <label>Category</label>
          <div className="category-grid">
            {categories.map((cat)=><button key={cat} type="button" className={`category-btn ${form1.category === cat ? "active" : ""}`} onClick={()=>setForm({
                ...form1,
                category: cat
            })}>
                {cat}
              </button>)}
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? "Adding..." : "Add Expense"}
        </button>
      </form>
    </div>;
}
}),
"[project]/app/components/ExpenseList [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ExpenseList
]);
"use client";
function ExpenseList({ expenses, onDelete }) {
    if (expenses.length === 0) {
        return <div className="expense-list-card">
        <h2>Recent Expenses</h2>
        <p className="no-data">No expenses yet. Add your first one above!</p>
      </div>;
    }
    const formatDate = (dateStr)=>{
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };
    return <div className="expense-list-card">
      <h2>Recent Expenses</h2>
      <div className="expense-list">
        {expenses.slice(0, 20).map((expense)=><div key={expense._id} className="expense-item">
            <div className="expense-info">
              <span className="expense-name">{expense.item}</span>
              <span className="expense-meta">
                {expense.category} · {formatDate(expense.date)}
              </span>
            </div>
            <div className="expense-right">
              <span className="expense-amount">
                €{expense.amount.toFixed(2)}
              </span>
              <button className="delete-btn" onClick={()=>onDelete(expense._id)} title="Delete">
                ✕
              </button>
            </div>
          </div>)}
      </div>
    </div>;
}
}),
"[project]/app/page.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ExpenseForm__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/ExpenseForm [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$Dashboard__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/Dashboard [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ExpenseList__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/ExpenseList [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function Home() {
    _s();
    const [expenses, setExpenses] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [activeTab, setActiveTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("dashboard");
    const fetchExpenses = async ()=>{
        try {
            const res = await fetch("/api/expenses");
            const data = await res.json();
            setExpenses(data);
        } catch (err) {
            console.error("Failed to fetch expenses:", err);
        } finally{
            setLoading(false);
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            fetchExpenses();
        }
    }["Home.useEffect"], []);
    const handleDelete = async (id)=>{
        if (!confirm("Delete this expense?")) return;
        try {
            await fetch(`/api/expenses/${id}`, {
                method: "DELETE"
            });
            fetchExpenses();
        } catch (err) {
            console.error("Failed to delete:", err);
        }
    };
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "loading-screen",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "spinner"
                }, void 0, false, {
                    fileName: "[project]/app/page.js",
                    lineNumber: 42,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: "Loading your expenses..."
                }, void 0, false, {
                    fileName: "[project]/app/page.js",
                    lineNumber: 43,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/page.js",
            lineNumber: 41,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "app",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "app-header",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        children: "💰 Expense Tracker"
                    }, void 0, false, {
                        fileName: "[project]/app/page.js",
                        lineNumber: 52,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "header-subtitle",
                        children: "Track every rupee, stay in control"
                    }, void 0, false, {
                        fileName: "[project]/app/page.js",
                        lineNumber: 53,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.js",
                lineNumber: 51,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                className: "tab-nav",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: `tab ${activeTab === "dashboard" ? "active" : ""}`,
                        onClick: ()=>setActiveTab("dashboard"),
                        children: "Dashboard"
                    }, void 0, false, {
                        fileName: "[project]/app/page.js",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: `tab ${activeTab === "add" ? "active" : ""}`,
                        onClick: ()=>setActiveTab("add"),
                        children: "Add Expense"
                    }, void 0, false, {
                        fileName: "[project]/app/page.js",
                        lineNumber: 64,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: `tab ${activeTab === "history" ? "active" : ""}`,
                        onClick: ()=>setActiveTab("history"),
                        children: "History"
                    }, void 0, false, {
                        fileName: "[project]/app/page.js",
                        lineNumber: 70,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.js",
                lineNumber: 57,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "main-content",
                children: [
                    activeTab === "dashboard" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$Dashboard__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        expenses: expenses
                    }, void 0, false, {
                        fileName: "[project]/app/page.js",
                        lineNumber: 80,
                        columnNumber: 39
                    }, this),
                    activeTab === "add" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ExpenseForm__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        onExpenseAdded: ()=>{
                            fetchExpenses();
                            setActiveTab("dashboard");
                        }
                    }, void 0, false, {
                        fileName: "[project]/app/page.js",
                        lineNumber: 82,
                        columnNumber: 11
                    }, this),
                    activeTab === "history" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$ExpenseList__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        expenses: expenses,
                        onDelete: handleDelete
                    }, void 0, false, {
                        fileName: "[project]/app/page.js",
                        lineNumber: 90,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.js",
                lineNumber: 79,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/page.js",
        lineNumber: 49,
        columnNumber: 5
    }, this);
}
_s(Home, "Al7T9HKva+GnyDiOps6PWcz43u8=");
_c = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_117mw0c._.js.map