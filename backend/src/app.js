const express = require("express");
const cors = require("cors");

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

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

module.exports = app;
