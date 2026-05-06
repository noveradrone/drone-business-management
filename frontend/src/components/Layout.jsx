import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import "../site-layout.css";

const NAV_SECTIONS = [
  {
    title: "General",
    items: [["/dashboard", "Dashboard"]]
  },
  {
    title: "Gestion",
    items: [
      ["/drones", "Drones"],
      ["/clients", "Clients"],
      ["/missions", "Missions"],
      ["/quotes", "Devis"],
      ["/invoices", "Factures"],
      ["/insurances", "Assurances"]
    ]
  },
  {
    title: "Administration",
    items: [
      ["/exports", "Exports"],
      ["/documents", "Documents"],
      ["/settings", "Parametres"]
    ]
  }
];

const TOKEN_KEYS = ["token", "authToken", "droneBusinessToken", "drone_business_token"];

export default function Layout({ children, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileOpen);
    return () => document.body.classList.remove("menu-open");
  }, [mobileOpen]);

  const renderedContent = useMemo(() => children ?? <Outlet />, [children]);

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
        // no-op
      }
    });

    window.location.href = "/login";
  };

  return (
    <div className="site-shell">
      <button
        type="button"
        className="menu-toggle site-menu-toggle btn btn-secondary"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-controls="site-sidebar"
      >
        Menu
      </button>

      <div
        className={`site-overlay ${mobileOpen ? "is-visible" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <aside id="site-sidebar" className={`site-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="site-sidebar__brand">Drone Business</div>

        <nav className="site-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="site-nav-section">
              <div className="site-nav-section__title">{section.title}</div>
              <div className="site-nav-links">
                {section.items.map(([to, label]) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      `site-nav-link ${isActive ? "is-active" : ""}`.trim()
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <button type="button" className="btn btn-secondary site-sidebar__logout" onClick={handleLogout}>
          Deconnexion
        </button>
        <div className="site-sidebar__spacer" aria-hidden="true" />
      </aside>

      <main className="site-main">{renderedContent}</main>
    </div>
  );
}
