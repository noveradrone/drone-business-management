import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, setToken } from "./api";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DronesPage from "./pages/DronesPage";
import ClientsPage from "./pages/ClientsPage";
import MissionsPage from "./pages/MissionsPage";
import QuotesPage from "./pages/QuotesPage";
import InvoicesPage from "./pages/InvoicesPage";
import InsurancesPage from "./pages/InsurancesPage";
import ExportsPage from "./pages/ExportsPage";
import SettingsPage from "./pages/SettingsPage";
import DocumentsPage from "./pages/DocumentsPage";
import PipelinePage from "./pages/PipelinePage";
import ReviewsPage from "./pages/ReviewsPage";
import ForecastPage from "./pages/ForecastPage";

export default function App() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    api.auth
      .me()
      .then(() => setAuthenticated(true))
      .catch(() => {
        setToken("");
        setAuthenticated(false);
      })
      .finally(() => setReady(true));
  }, []);

  function logout() {
    setToken("");
    setAuthenticated(false);
  }

  if (!ready) return <div className="loading">Initialisation...</div>;
  if (!authenticated) return <LoginPage onLogin={() => setAuthenticated(true)} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout onLogout={logout} />}>
          <Route index element={<DashboardPage />} />
          <Route path="drones" element={<DronesPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="missions" element={<MissionsPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="insurances" element={<InsurancesPage />} />
          <Route path="exports" element={<ExportsPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
