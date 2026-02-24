import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";

const navItems = [
  ["/", "Dashboard"],
  ["/drones", "Drones"],
  ["/clients", "Clients"],
  ["/missions", "Missions"],
  ["/quotes", "Devis"],
  ["/invoices", "Factures"],
  ["/insurances", "Assurances"],
  ["/pipeline", "Pipeline"],
  ["/reviews", "Avis Google"],
  ["/forecast", "Previsionnel"],
  ["/exports", "Exports"],
  ["/documents", "Documents"],
  ["/settings", "Parametres"]
];

export default function Layout({ onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Drone Business</div>
        <div className="topbar-actions">
          <button className="secondary mobile-menu-btn" onClick={() => setMobileMenuOpen((v) => !v)}>
            ☰ Menu
          </button>
          <span className="pill">Apple-style UI</span>
          <button className="secondary" onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      <div className="shell-grid">
        <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
          {navItems.map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </aside>
        {mobileMenuOpen && <button className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer le menu" />}

        <main className="surface main-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
