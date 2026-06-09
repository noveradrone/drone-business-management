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
      const { token, user } = await api.auth.login({ email, password });
      setToken(token);
      await onLogin(user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-layout">
        <section className="login-intro">
          <p className="login-eyebrow">Drone Business Management</p>
          <h1>Le cockpit premium pour piloter une activité drone comme un vrai SaaS.</h1>
          <p>
            Gestion de flotte, CRM, missions, devis, factures, assurances et documents dans une interface claire,
            rapide et premium pensée pour un usage quotidien.
          </p>
        </section>

        <div className="login-card">
          <h2>Connexion</h2>
          <p>Accède à ton espace d’exploitation</p>
          <form onSubmit={submit} className="form-grid login-form">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" type="password" required />
            <button type="submit">Se connecter</button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
