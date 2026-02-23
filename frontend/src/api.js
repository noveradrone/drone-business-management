const API_BASE = import.meta.env.VITE_API_BASE || "/api";

let token = localStorage.getItem("dbm_token") || "";

export function setToken(value) {
  token = value;
  if (value) localStorage.setItem("dbm_token", value);
  else localStorage.removeItem("dbm_token");
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error(
      `Impossible de joindre l'API (${API_BASE}). Vérifie que le backend tourne sur le port 4000.`
    );
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed (${res.status})`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.blob();
}

export const api = {
  auth: {
    login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    me: () => request("/auth/me")
  },
  dashboard: {
    summary: () => request("/dashboard/summary"),
    reminders: () => request("/dashboard/reminders")
  },
  drones: {
    list: () => request("/drones"),
    create: (data) => request("/drones", { method: "POST", body: JSON.stringify(data) })
  },
  clients: {
    list: () => request("/clients"),
    create: (data) => request("/clients", { method: "POST", body: JSON.stringify(data) })
  },
  missions: {
    list: () => request("/missions"),
    create: (data) => request("/missions", { method: "POST", body: JSON.stringify(data) })
  },
  quotes: {
    list: () => request("/quotes"),
    get: (id) => request(`/quotes/${id}`),
    create: (data) => request("/quotes", { method: "POST", body: JSON.stringify(data) }),
    pdf: (id) => request(`/quotes/${id}/pdf`)
  },
  invoices: {
    list: () => request("/invoices"),
    get: (id) => request(`/invoices/${id}`),
    create: (data) => request("/invoices", { method: "POST", body: JSON.stringify(data) }),
    pdf: (id) => request(`/invoices/${id}/pdf`),
    addPayment: (id, data) =>
      request(`/invoices/${id}/payments`, { method: "POST", body: JSON.stringify(data) }),
    paymentReceiptPdf: (id, paymentId) => request(`/invoices/${id}/payments/${paymentId}/receipt-pdf`)
  },
  insurances: {
    list: () => request("/insurances"),
    create: (data) => request("/insurances", { method: "POST", body: JSON.stringify(data) })
  },
  settings: {
    company: () => request("/settings/company"),
    updateCompany: (data) => request("/settings/company", { method: "PUT", body: JSON.stringify(data) })
  },
  exports: {
    csv: (entity) => request(`/exports/csv/${entity}`)
  },
  meta: {
    base: API_BASE
  }
};
