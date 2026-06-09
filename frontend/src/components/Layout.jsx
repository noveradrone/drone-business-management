import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import "../site-layout.css";
import "../site-spacing.css";
import {
  applyTheme,
  DEFAULT_THEME,
  getAppearanceSettingsFromLocal,
  fromAppearanceSettings,
  persistAppearanceSettings
} from "../theme";

const NAV_SECTIONS = [
  {
    title: "Gestion",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: "⌂", keywords: ["accueil", "kpi", "tableau"] },
      { to: "/drones", label: "Drones", icon: "◫", keywords: ["flotte", "maintenance", "drone"] },
      { to: "/clients", label: "Clients", icon: "◎", keywords: ["crm", "prospect", "client"] },
      { to: "/missions", label: "Missions", icon: "✦", keywords: ["vol", "planning", "kanban"] }
    ]
  },
  {
    title: "Finance",
    items: [
      { to: "/quotes", label: "Devis", icon: "¤", keywords: ["quote", "proposition"] },
      { to: "/invoices", label: "Factures", icon: "▣", keywords: ["paiement", "encaissement", "invoice"] }
    ]
  },
  {
    title: "Administration",
    items: [
      { to: "/documents", label: "Documents", icon: "☰", keywords: ["pdf", "kbis", "manex"] },
      { to: "/insurances", label: "Assurances", icon: "⛨", keywords: ["contrat", "expiration", "rc pro"] },
      { to: "/exports", label: "Exports", icon: "⇪", keywords: ["csv", "export"] },
      { to: "/settings", label: "Parametres", icon: "⚙", keywords: ["theme", "societe", "securite"] }
    ]
  }
];

const TOKEN_KEYS = ["token", "authToken", "droneBusinessToken", "drone_business_token", "dbm_token"];

function buildBreadcrumb(pathname) {
  const map = {
    "/dashboard": ["Dashboard"],
    "/drones": ["Gestion", "Drones"],
    "/clients": ["Gestion", "Clients"],
    "/missions": ["Gestion", "Missions"],
    "/quotes": ["Finance", "Devis"],
    "/invoices": ["Finance", "Factures"],
    "/documents": ["Administration", "Documents"],
    "/insurances": ["Administration", "Assurances"],
    "/exports": ["Administration", "Exports"],
    "/settings": ["Administration", "Parametres"]
  };
  return map[pathname] || ["Drone Business"];
}

function searchItems(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return NAV_SECTIONS.flatMap((section) => section.items)
    .filter((item) => {
      const haystack = [item.label, ...(item.keywords || [])].join(" ").toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, 6);
}

export default function Layout({ children, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [themeMode, setThemeMode] = useState(() => document.documentElement.dataset.mode || "light");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileOpen);
    return () => document.body.classList.remove("menu-open");
  }, [mobileOpen]);

  useEffect(() => {
    setQuery("");
    setMobileOpen(false);
  }, [location.pathname]);

  const renderedContent = useMemo(() => children ?? <Outlet />, [children]);
  const closeMenu = () => setMobileOpen(false);
  const breadcrumb = useMemo(() => buildBreadcrumb(location.pathname), [location.pathname]);
  const results = useMemo(() => searchItems(query), [query]);

  const handleLogout = () => {
    closeMenu();
    if (typeof onLogout === "function") {
      onLogout();
      return;
    }

    TOKEN_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch {
        // noop
      }
    });

    window.location.href = "/login";
  };

  const handleThemeToggle = () => {
    const localSettings = getAppearanceSettingsFromLocal();
    const currentTheme = fromAppearanceSettings(localSettings) || {
      ...DEFAULT_THEME,
      mode: document.documentElement.dataset.mode || "light",
      theme_id: document.documentElement.dataset.themeId || DEFAULT_THEME.theme_id,
      density: document.documentElement.dataset.density || DEFAULT_THEME.density,
      shadows_enabled: 1,
      radius_style: "rounded"
    };
    const nextTheme = { ...currentTheme, mode: currentTheme.mode === "dark" ? "light" : "dark" };
    applyTheme(nextTheme);
    persistAppearanceSettings(nextTheme, nextTheme.user_id || null);
    setThemeMode(nextTheme.mode);
  };

  return (
    <div className="site-shell modern-shell">
      <button
        type="button"
        className="menu-toggle site-menu-toggle btn btn-ghost"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-controls="site-sidebar"
      >
        ☰ Menu
      </button>

      <div className={`site-overlay ${mobileOpen ? "is-visible" : ""}`} onClick={closeMenu} aria-hidden="true" />

      <aside id="site-sidebar" className={`site-sidebar modern-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand-card">
          <div className="sidebar-brand-mark">ND</div>
          <div>
            <p className="sidebar-brand-label">Drone Business</p>
            <h1 className="sidebar-brand-title">Novera Drone</h1>
            <p className="sidebar-brand-meta">Operations Console</p>
          </div>
        </div>

        <nav className="site-sidebar__nav modern-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="site-nav-section modern-nav-section">
              <div className="site-nav-section__title">{section.title}</div>
              <div className="site-nav-links">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    onClick={closeMenu}
                    className={({ isActive }) => `site-nav-link modern-nav-link ${isActive ? "is-active" : ""}`.trim()}
                  >
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-profile-card">
          <div className="sidebar-profile-avatar">EO</div>
          <div>
            <div className="sidebar-profile-name">Equipe Novera</div>
            <div className="sidebar-profile-role">Admin</div>
          </div>
          <button type="button" className="btn btn-ghost sidebar-logout-btn" onClick={handleLogout}>Deconnexion</button>
        </div>
        <div className="site-sidebar__spacer" aria-hidden="true" />
      </aside>

      <div className="site-workspace">
        <header className="workspace-topbar">
          <div className="topbar-search-wrap">
            <div className="topbar-search-shell">
              <span className="topbar-search-icon" aria-hidden="true">⌕</span>
              <input
                className="topbar-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une page, un module, une action..."
              />
            </div>
            {query && results.length ? (
              <div className="search-results-popover">
                {results.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    className="search-result-item"
                    onClick={() => {
                      navigate(item.to);
                      setQuery("");
                    }}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="workspace-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="breadcrumb-item">
                {index > 0 ? <span className="breadcrumb-separator">/</span> : null}
                <span>{crumb}</span>
              </span>
            ))}
          </div>

          <div className="workspace-tools">
            <button type="button" className="tool-chip notification-chip" aria-label="Notifications">
              ⌁ <span>3</span>
            </button>
            <button type="button" className="tool-chip" onClick={handleThemeToggle} aria-label="Changer le theme">
              {themeMode === "dark" ? "☀ Clair" : "☾ Sombre"}
            </button>
            <div className="tool-profile">
              <div className="tool-profile-avatar">EO</div>
              <div className="tool-profile-copy">
                <strong>Enes Ozturk</strong>
                <span>Workspace principal</span>
              </div>
            </div>
          </div>
        </header>

        <main className="site-main modern-main">{renderedContent}</main>
      </div>
    </div>
  );
}
