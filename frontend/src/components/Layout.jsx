import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const DENSITY_KEY = "drone_business_density";

const navGroups = [
  {
    title: "Gestion",
    items: [
      ["/clients", "Clients"],
      ["/missions", "Missions"],
      ["/quotes", "Devis"],
      ["/invoices", "Factures"],
      ["/thermography", "Thermographie"],
      ["/drones", "Drones"],
      ["/insurances", "Assurances"]
    ]
  },
  {
    title: "Analyse",
    items: [
      ["/pipeline", "Pipeline"],
      ["/forecast", "Previsionnel"],
      ["/reviews", "Avis Google"],
      ["/exports", "Exports"]
    ]
  },
  {
    title: "Administration",
    items: [
      ["/documents", "Documents"],
      ["/settings", "Parametres"]
    ]
  }
];

export default function Layout({ onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem(DENSITY_KEY) === "compact");
  const lockedScrollYRef = useRef(0);

  useEffect(() => {
    const density = compactMode ? "compact" : "comfortable";
    document.documentElement.setAttribute("data-density", density);
    localStorage.setItem(DENSITY_KEY, density);
  }, [compactMode]);

  useEffect(() => {
    if (mobileMenuOpen) {
      lockedScrollYRef.current = window.scrollY || 0;
      document.body.classList.add("menu-open");
      document.body.style.top = `-${lockedScrollYRef.current}px`;
    } else {
      const top = Number.parseInt(document.body.style.top || "0", 10) || 0;
      document.body.classList.remove("menu-open");
      document.body.style.top = "";
      if (top) window.scrollTo(0, Math.abs(top));
    }
    return () => {
      const top = Number.parseInt(document.body.style.top || "0", 10) || 0;
      document.body.classList.remove("menu-open");
      document.body.style.top = "";
      if (top) window.scrollTo(0, Math.abs(top));
    };
  }, [mobileMenuOpen]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Drone Business</div>
        <div className="topbar-actions">
          <button className="secondary menu-toggle" onClick={() => setMobileMenuOpen((v) => !v)}>
            ☰ Menu
          </button>
          <button className="secondary compact-toggle" type="button" onClick={() => setCompactMode((v) => !v)}>
            {compactMode ? "Mode confortable" : "Mode compact"}
          </button>
          <button className="secondary" onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      <div className="shell-grid">
        <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
          <div className="sidebar-content">
            <NavLink
              key="/"
              to="/"
              end
              className={({ isActive }) => `nav-link nav-link-main${isActive ? " active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </NavLink>

            {navGroups.map((group) => (
              <div key={group.title} className="nav-group">
                <p className="nav-group-title">{group.title}</p>
                {group.items.map(([path, label]) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
            <div className="drawer-spacer" aria-hidden="true" />
          </div>
        </aside>
        {mobileMenuOpen && (
          <button className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer le menu" />
        )}

        <main className="surface main-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
