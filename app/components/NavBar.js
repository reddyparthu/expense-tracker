"use client";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { id: "dashboard", label: "Home" },
  { id: "history", label: "History" },
  { id: "insights", label: "Insights" },
];

const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" />
    </svg>
  ),
  insights: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
};

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">S</span>
      <span className="logo-word">SPENDWISE</span>
    </span>
  );
}

function Avatar({ user, size = 32 }) {
  const initial = (user?.name || user?.email || "U").trim()[0].toUpperCase();
  return user?.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.image} alt="" className="avatar" style={{ width: size, height: size }} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size }}>
      {initial}
    </span>
  );
}

function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="profile" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        <Avatar user={user} />
        <span className={`profile-caret ${open ? "open" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="profile-menu glass">
          <div className="profile-head">
            <Avatar user={user} size={40} />
            <div className="profile-id">
              <span className="profile-name">{user?.name || "You"}</span>
              <span className="profile-email">{user?.email}</span>
            </div>
          </div>
          <div className="profile-sep" />
          <ThemeToggle withLabel />
          <button className="profile-item" onClick={() => signOut()}>
            <span className="profile-item-icon">⎋</span> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function NavBar({ active, onChange, user }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`topnav ${scrolled ? "scrolled" : ""}`}>
        <div className="topnav-inner">
          <button className="logo-btn" onClick={() => onChange("dashboard")} aria-label="Home">
            <Logo />
          </button>

          <nav className="topnav-links">
            {LINKS.map((l) => (
              <button
                key={l.id}
                className={`topnav-link ${active === l.id ? "active" : ""}`}
                onClick={() => onChange(l.id)}
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="topnav-right">
            <button className={`nav-pill ghost ${active === "scan" ? "active" : ""}`} onClick={() => onChange("scan")}>
              <span className="nav-pill-icon">{Icon.scan}</span>
              Scan
            </button>
            <button className={`nav-pill solid ${active === "add" ? "active" : ""}`} onClick={() => onChange("add")}>
              <span className="nav-pill-icon">{Icon.plus}</span>
              Add
            </button>
            <ProfileMenu user={user} />
          </div>
        </div>
      </header>

      <nav className="bottomnav glass" aria-label="Main">
        {[
          { id: "dashboard", label: "Home", icon: Icon.home },
          { id: "history", label: "History", icon: Icon.history },
          { id: "add", label: "Add", icon: Icon.plus, fab: true },
          { id: "scan", label: "Scan", icon: Icon.scan },
          { id: "insights", label: "Insights", icon: Icon.insights },
        ].map((t) => (
          <button
            key={t.id}
            className={`bottomnav-item ${t.fab ? "fab" : ""} ${active === t.id ? "active" : ""}`}
            onClick={() => onChange(t.id)}
            aria-label={t.label}
          >
            <span className="bottomnav-icon">{t.icon}</span>
            {!t.fab && <span className="bottomnav-label">{t.label}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}
