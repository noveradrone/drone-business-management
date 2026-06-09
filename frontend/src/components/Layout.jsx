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
      { to: "/dashboard", label: "Dashboard", keywords: ["accueil", "kpi", "tableau"] },
      { to: "/drones", label: "Drones", keywords: ["flotte", "maintenance", "drone"] },
      { to: "/clients", label: "Clients", keywords: ["crm", "prospect", "client"] },
      { to: "/missions", label: "Missions", keywords: ["vol", "planning"] }
    ]
  },
  {
    title: "Finance",
    items: [
      { to: "/quotes", label: "Devis", keywords: ["quote", "proposition"] },
      { to: "/invoices", label: "Factures", keywords: ["paiement", "encaissement", "invoice"] }
    ]
  },
  {
    title: "Administration",
    items: [
      { to: "/documents", label: "Documents", keywords: ["pdf", "kbis", "manex"] },
      { to: "/insurances", label: "Assurances", keywords: ["contrat", "expiration", "rc pro"] },
      { to: "/exports", label: "Exports", keywords: ["csv", "export"] },
      { to: "/settings", label: "Parametres", keywords: ["theme", "societe", "securite"] }
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
    .filter((item) => [item.label, ...(item.keywords || [])].join(" ").toLowerCase().includes(normalized))
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
  const breadcrumb = useMemo(() => buildBreadcrumb(location.pathname), [location.pathname]);
  const results = useMemo(() => searchItems(query), [query]);

  const closeMenu = () => setMobileOpen(false);

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
    <div className="app-shell layout-shell">
      <button
        type="button"
        className="menu-toggle layout-menu-toggle btn btn-ghost"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-controls="site-sidebar"
      >
        Menu
      </button>

      <div className={`layout-overlay ${mobileOpen ? "is-visible" : ""}`} onClick={closeMenu} aria-hidden="true" />

      <aside id="site-sidebar" className={`sidebar layout-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand-card simple-brand-card">
          <div className="sidebar-brand-mark">ND</div>
          <div>
            <p className="sidebar-brand-label">Drone Business</p>
            <h1 className="sidebar-brand-title">Novera Drone</h1>
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
                    onClick={closeMenu}
                    className={({ isActive }) => `site-nav-link modern-nav-link ${isActive ? "is-active" : ""}`.trim()}
                  >
                    <span className="nav-icon nav-icon-minimal" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-profile-card simple-profile-card">
          <div className="sidebar-profile-avatar">EO</div>
          <div>
            <div className="sidebar-profile-name">Enes Ozturk</div>
            <div className="sidebar-profile-role">Administrateur</div>
          </div>
          <button type="button" className="btn btn-ghost sidebar-logout-btn" onClick={handleLogout}>Deconnexion</button>
        </div>
        <div className="drawer-spacer layout-drawer-spacer" aria-hidden="true" />
      </aside>

      <div className="app-main layout-main">
        <header className="topbar layout-topbar">
          <div className="workspace-breadcrumb simple-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="breadcrumb-item">
                {index > 0 ? <span className="breadcrumb-separator">/</span> : null}
                <span>{crumb}</span>
              </span>
            ))}
          </div>

          <div className="topbar-search-wrap compact-search-wrap">
            <div className="topbar-search-shell compact-search-shell">
              <span className="topbar-search-icon" aria-hidden="true">⌕</span>
              <input
                className="topbar-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher..."
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
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="workspace-tools compact-tools">
            <button type="button" className="tool-chip" onClick={handleThemeToggle} aria-label="Changer le theme">
              {themeMode === "dark" ? "Clair" : "Sombre"}
            </button>
            <div className="tool-profile compact-profile">
              <div className="tool-profile-avatar">EO</div>
            </div>
          </div>
        </header>

        <main className="site-main page-content layout-page-content">{renderedContent}</main>
      </div>
    </div>
  );
}
