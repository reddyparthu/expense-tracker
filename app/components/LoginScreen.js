"use client";
import { signIn } from "next-auth/react";
import FluidBackground from "./FluidBackground";
import { Logo } from "./NavBar";
import { catMeta } from "@/lib/categories";

// Decorative product preview shown beside the sign-in copy (sample numbers only)
const PREVIEW_BARS = [32, 48, 26, 64, 40, 78, 52, 88, 44, 70, 58, 96];
const PREVIEW_CATS = [
  { name: "Food & Groceries", amount: "€412.80", pct: 38 },
  { name: "Transport", amount: "€186.40", pct: 17 },
  { name: "Entertainment", amount: "€94.20", pct: 9 },
];

export default function LoginScreen() {
  return (
    <div className="login">
      <FluidBackground />

      <header className="login-top">
        <Logo />
      </header>

      <main className="login-main">
        <section className="login-copy">
          <span className="eyebrow">Personal finance, refined</span>
          <h1 className="login-title">
            Know where
            <br />
            every <span className="grad-text">euro</span> goes.
          </h1>
          <p className="login-subtitle">
            Log expenses in seconds, scan receipts, and see clear, beautiful insights into your spending — day by
            day, month by month.
          </p>

          <button className="google-btn" onClick={() => signIn("google")}>
            <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <ul className="login-points">
            <li>Receipt scanning</li>
            <li>Swipe through any period</li>
            <li>Private to your account</li>
          </ul>
        </section>

        <section className="login-preview" aria-hidden="true">
          <div className="preview-card preview-main glass">
            <span className="eyebrow">Monthly overview</span>
            <span className="preview-period">October</span>
            <span className="preview-total">€1,094.60</span>
            <span className="preview-change">▼ 12% vs last month</span>
            <div className="preview-bars">
              {PREVIEW_BARS.map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          <div className="preview-card preview-cats glass">
            {PREVIEW_CATS.map((c) => {
              const meta = catMeta(c.name);
              return (
                <div key={c.name} className="preview-cat">
                  <span className="preview-cat-icon" style={{ background: meta.art }}>
                    {meta.icon}
                  </span>
                  <span className="preview-cat-info">
                    <span className="preview-cat-name">{meta.short}</span>
                    <span className="preview-cat-bar">
                      <span style={{ width: `${c.pct * 2}%`, background: meta.color }} />
                    </span>
                  </span>
                  <span className="preview-cat-amount">{c.amount}</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="login-footer">Free forever · Your data stays private</footer>
    </div>
  );
}
