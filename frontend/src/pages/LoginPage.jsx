import { useState } from "react";
import { api, setToken } from "../api";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const { token } = await api.auth.login({ email, password });
      setToken(token);
      onLogin();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-layout">
        <section className="login-intro">
          <p className="login-eyebrow">Novera Drone</p>
          <h1>Pilote ton activité drone depuis une seule plateforme</h1>
          <p>
            Suivi missions, devis, factures, assurances et documents officiels dans un espace
            clair, rapide et sécurisé.
          </p>
        </section>

        <div className="login-card">
          <h2>Connexion</h2>
          <p>Gestion d’entreprise de drone</p>
          <form onSubmit={submit} className="form-grid login-form">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              type="password"
              required
            />
            <button type="submit">Se connecter</button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
