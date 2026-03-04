const express = require("express");
const cors = require("cors");
const { securityHeaders } = require("./middleware/security");
const { apiLimiter } = require("./middleware/rateLimit");
const { allowedOrigins, jsonBodyLimit, urlencodedBodyLimit, nodeEnv, jwtSecret } = require("./config");

require("./db");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const dronesRoutes = require("./routes/drones");
const maintenanceRoutes = require("./routes/maintenance");
const clientsRoutes = require("./routes/clients");
const missionsRoutes = require("./routes/missions");
const quotesRoutes = require("./routes/quotes");
const invoicesRoutes = require("./routes/invoices");
const insurancesRoutes = require("./routes/insurances");
const dashboardRoutes = require("./routes/dashboard");
const exportsRoutes = require("./routes/exports");
const settingsRoutes = require("./routes/settings");
const pipelineRoutes = require("./routes/pipeline");
const reviewsRoutes = require("./routes/reviews");
const forecastRoutes = require("./routes/forecast");
const articlesRoutes = require("./routes/articles");
const documentsRoutes = require("./routes/documents");
const flightPreparationRoutes = require("./routes/flightPreparation");

const app = express();
if (nodeEnv === "production" && (!jwtSecret || jwtSecret.length < 32 || jwtSecret === "change-me-in-production")) {
  throw new Error("JWT_SECRET invalide: definissez un secret robuste (32+ caracteres) en production.");
}

app.use(securityHeaders);
app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server and same-origin requests without Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    }
  })
);
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: urlencodedBodyLimit }));
app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "drone-business-management-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/drones", dronesRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/missions", missionsRoutes);
app.use("/api/quotes", quotesRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/insurances", insurancesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/exports", exportsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/pipeline", pipelineRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/articles", articlesRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/flight-preparation", flightPreparationRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.message === "CORS origin not allowed") {
    return res.status(403).json({ message: "Origin non autorisee" });
  }
  return res.status(500).json({ message: "Internal server error" });
});

module.exports = app;
