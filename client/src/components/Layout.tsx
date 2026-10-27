import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  FlaskConical,
  GitBranch,
  GitCompareArrows,
  LayoutDashboard,
  LibraryBig,
  Menu,
  Network,
  Plus,
  Quote,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { DemoBanner } from "@/components/DemoBanner";
import { useArchive } from "@/context/ArchiveContext";
import { cn } from "@/lib/utils";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/library", label: "Archive", icon: LibraryBig },
  { to: "/compare", label: "Compare accounts", icon: GitCompareArrows },
  { to: "/claims", label: "Claim explorer", icon: Quote },
  { to: "/map", label: "Research map", icon: Network },
];

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="brand-mark" aria-hidden="true">
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12.5h22M9 19.5h13M9 26.5h22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M27 17v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="27" cy="28.5" r="2" fill="currentColor" />
    </svg>
  );
}

export function Layout() {
  const { recordings, aiStatus, aiStatusError } = useArchive();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const demoCount = recordings.filter((recording) => recording.isDemo).length;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  const statusLabel = aiStatus?.configured
    ? "Gemini connected"
    : aiStatusError
      ? "Local server offline"
      : "Gemini not configured";
  const statusTone = aiStatus?.configured ? "online" : aiStatusError ? "offline" : "standby";

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={cn("sidebar", mobileOpen && "sidebar--open")} aria-label="EchoLedger navigation">
        <div className="sidebar__brand-row">
          <Link to="/" className="brand" aria-label="EchoLedger home">
            <BrandMark />
            <span>
              <strong>EchoLedger</strong>
              <small>Oral history, evidence-linked</small>
            </span>
          </Link>
          <button
            type="button"
            className="icon-button sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <Link to="/recordings/new" className="button button--primary sidebar__cta">
          <Plus size={16} aria-hidden="true" />
          Add a recording
        </Link>

        <nav className="sidebar__nav" aria-label="Primary">
          <p className="nav-label">Workspace</p>
          {navigation.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn("nav-item", isActive && "nav-item--active")}
            >
              <item.icon size={17} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}

          <p className="nav-label">Research</p>
          {navigation.slice(2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn("nav-item", isActive && "nav-item--active")}
            >
              <item.icon size={17} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}

          <p className="nav-label">Configuration</p>
          <NavLink
            to="/settings"
            className={({ isActive }) => cn("nav-item", isActive && "nav-item--active")}
          >
            <Settings2 size={17} aria-hidden="true" />
            Settings & AI
          </NavLink>
        </nav>

        {demoCount > 0 ? (
          <Link to="/settings" className="sidebar__demo">
            <FlaskConical size={15} aria-hidden="true" />
            <span>
              <strong>{demoCount} demo records</strong>
              <small>Fictional data — review before use</small>
            </span>
          </Link>
        ) : null}

        <div className="sidebar__footer">
          <Link to="/settings" className={cn("ai-status", `ai-status--${statusTone}`)}>
            <span className="ai-status__dot" aria-hidden="true" />
            <span>
              <strong>{statusLabel}</strong>
              <small>Archive data stays in this browser</small>
            </span>
          </Link>
          <p className="sidebar__privacy">
            <ShieldCheck size={13} aria-hidden="true" /> Local-first by default
          </p>
          <a className="sidebar__github" href="https://github.com/rohanhalaj18/EchoLedger" target="_blank" rel="noreferrer">
            <GitBranch size={13} aria-hidden="true" /> Open source · MIT
          </a>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-bar">
          <button
            type="button"
            className="icon-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu size={20} />
          </button>
          <Link to="/" className="brand brand--mobile">
            <BrandMark />
            <span>
              <strong>EchoLedger</strong>
            </span>
          </Link>
          <Link to="/recordings/new" className="icon-button" aria-label="Add a recording">
            <Plus size={20} />
          </Link>
        </header>

        <main id="main-content" className="main-content">
          {demoCount > 0 ? <DemoBanner /> : null}
          <Outlet />
        </main>

        <footer className="app-footer">
          <p>Every story matters. Every claim has a source.</p>
          <p>
            EchoLedger is a research aid, not a historical authority. AI output is provisional and
            must be checked against source evidence.
          </p>
        </footer>
      </div>
    </div>
  );
}
