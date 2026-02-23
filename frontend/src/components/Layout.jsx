import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  ["/", "Dashboard"],
  ["/drones", "Drones"],
  ["/clients", "Clients"],
  ["/missions", "Missions"],
  ["/quotes", "Devis"],
  ["/invoices", "Factures"],
  ["/insurances", "Assurances"],
  ["/exports", "Exports"],
  ["/documents", "Documents"],
  ["/settings", "Parametres"]
];

export default function Layout({ onLogout }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Drone Business</div>
        <div className="topbar-actions">
          <span className="pill">Apple-style UI</span>
          <button className="secondary" onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      <div className="shell-grid">
        <aside className="sidebar">
          {navItems.map(([path, label]) => (
            <NavLink key={path} to={path} end={path === "/"} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              {label}
            </NavLink>
          ))}
        </aside>

        <main className="surface main-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
