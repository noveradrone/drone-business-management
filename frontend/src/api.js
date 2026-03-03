const API_BASE = import.meta.env.VITE_API_BASE;

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
    throw new Error("Impossible de joindre l'API.");
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
    create: (data) => request("/drones", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/drones/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id) => request(`/drones/${id}`, { method: "DELETE" })
  },
  clients: {
    list: () => request("/clients"),
    create: (data) => request("/clients", { method: "POST", body: JSON.stringify(data) }),
    remove: (id) => request(`/clients/${id}`, { method: "DELETE" })
  },
  missions: {
    list: () => request("/missions"),
    create: (data) => request("/missions", { method: "POST", body: JSON.stringify(data) }),
    remove: (id) => request(`/missions/${id}`, { method: "DELETE" })
  },
  pipeline: {
    list: () => request("/pipeline"),
    upsert: (data) => request("/pipeline/upsert", { method: "POST", body: JSON.stringify(data) }),
    stats: () => request("/pipeline/stats")
  },
  reviews: {
    refresh: () => request("/reviews/refresh", { method: "POST", body: JSON.stringify({}) }),
    eligible: () => request("/reviews/eligible"),
    send: (id) => request(`/reviews/send/${id}`, { method: "POST", body: JSON.stringify({}) })
  },
  forecast: {
    summary: () => request("/forecast/summary")
  },
  documents: {
    list: (params = {}) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") search.set(key, value);
      });
      const suffix = search.toString() ? `?${search.toString()}` : "";
      return request(`/documents${suffix}`);
    },
    upload: (data) => request("/documents", { method: "POST", body: JSON.stringify(data) }),
    replace: (id, data) => request(`/documents/${id}/replace`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id) => request(`/documents/${id}`, { method: "DELETE" }),
    download: async (id) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/documents/${id}/download`, { headers });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || `Request failed (${res.status})`);
      }
      return res.blob();
    }
  },
  quotes: {
    list: (params = {}) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") search.set(key, value);
      });
      const suffix = search.toString() ? `?${search.toString()}` : "";
      return request(`/quotes${suffix}`);
    },
    stats: () => request("/quotes/stats"),
    nextNumber: (quoteDate) => request(`/quotes/next-number?date=${encodeURIComponent(quoteDate)}`),
    get: (id) => request(`/quotes/${id}`),
    create: (data) => request("/quotes", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/quotes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    send: (id) => request(`/quotes/${id}/send`, { method: "POST", body: JSON.stringify({}) }),
    convertToInvoice: (id) =>
      request(`/quotes/${id}/convert-to-invoice`, { method: "POST", body: JSON.stringify({}) }),
    pdf: (id) => request(`/quotes/${id}/pdf`),
    remove: (id) => request(`/quotes/${id}`, { method: "DELETE" })
  },
  invoices: {
    list: () => request("/invoices"),
    stats: () => request("/invoices/stats"),
    nextNumber: (invoiceDate) => request(`/invoices/next-number?date=${encodeURIComponent(invoiceDate)}`),
    get: (id) => request(`/invoices/${id}`),
    create: (data) => request("/invoices", { method: "POST", body: JSON.stringify(data) }),
    pdf: (id) => request(`/invoices/${id}/pdf`),
    addPayment: (id, data) =>
      request(`/invoices/${id}/payments`, { method: "POST", body: JSON.stringify(data) }),
    markPaid: (id, data) => request(`/invoices/${id}/mark-paid`, { method: "POST", body: JSON.stringify(data) }),
    paymentReceiptPdf: (id, paymentId) => request(`/invoices/${id}/payments/${paymentId}/receipt-pdf`),
    remove: (id) => request(`/invoices/${id}`, { method: "DELETE" })
  },
  articles: {
    list: () => request("/articles"),
    create: (data) => request("/articles", { method: "POST", body: JSON.stringify(data) })
  },
  insurances: {
    list: () => request("/insurances"),
    create: (data) => request("/insurances", { method: "POST", body: JSON.stringify(data) }),
    remove: (id) => request(`/insurances/${id}`, { method: "DELETE" })
  },
  settings: {
    company: () => request("/settings/company"),
    updateCompany: (data) => request("/settings/company", { method: "PUT", body: JSON.stringify(data) }),
    theme: () => request("/settings/theme"),
    updateTheme: (data) => request("/settings/theme", { method: "PUT", body: JSON.stringify(data) }),
    resetTheme: () => request("/settings/theme", { method: "DELETE" })
  },
  exports: {
    csv: (entity) => request(`/exports/csv/${entity}`)
  },
  meta: {
    base: API_BASE
  }
};
