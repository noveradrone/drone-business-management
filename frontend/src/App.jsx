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
import {
  applyTheme,
  DEFAULT_THEME,
  persistAppearanceSettings,
  getAppearanceSettingsFromLocal,
  fromAppearanceSettings
} from "./theme";

export default function App() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  async function hydrateTheme(userId = null) {
    const localSettings = getAppearanceSettingsFromLocal(userId);
    if (localSettings) {
      const localTheme = fromAppearanceSettings(localSettings);
      if (localTheme) applyTheme(localTheme);
    }

    try {
      const remoteTheme = await api.settings.theme();
      applyTheme(remoteTheme);
      persistAppearanceSettings(remoteTheme, remoteTheme?.user_id || userId || null);
    } catch {
      if (!localSettings) applyTheme(DEFAULT_THEME);
    }
  }

  useEffect(() => {
    const localSettings = getAppearanceSettingsFromLocal();
    const localTheme = fromAppearanceSettings(localSettings);
    if (localTheme) applyTheme(localTheme);

    api.auth
      .me()
      .then(async (me) => {
        setAuthenticated(true);
        await hydrateTheme(me?.id || null);
      })
      .catch(() => {
        setToken("");
        setAuthenticated(false);
        if (!localTheme) applyTheme(DEFAULT_THEME);
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    setToken("");
    setAuthenticated(false);
  }

  async function handleLogin(user = null) {
    setAuthenticated(true);
    await hydrateTheme(user?.id || null);
  }

  if (!ready) return <div className="loading">Initialisation...</div>;
  if (!authenticated) return <LoginPage onLogin={handleLogin} />;

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
