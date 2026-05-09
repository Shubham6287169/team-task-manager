require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend from project root
app.use(express.static(__dirname));

// API Routes
app.use("/api/auth", require("./auth-routes"));
app.use("/api/projects", require("./projects"));
app.use("/api/tasks", require("./tasks"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), version: "1.0.0" });
});

// SPA fallback — serve React frontend for all non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error.", details: process.env.NODE_ENV === "development" ? err.message : undefined });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Team Task Manager running on http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
