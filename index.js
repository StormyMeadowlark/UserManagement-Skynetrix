const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config"); // Centralized config
const connectDB = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swaggerConfig");

// Initialize Express
const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// MongoDB Connection
connectDB();

// API Versioning
const API_BASE = "/api/v2";
app.use(
  `${API_BASE}/users/docs`,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);


// Test Route
app.get("/", (req, res) => {
  res.status(200).json({ message: "User Management API is running!" });
});

// Health Check Route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "Healthy", timestamp: new Date() });
});

// Centralized Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

// Start Server Only When Not in Test Mode
if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
  });
}

// Export the app for testing
module.exports = app;
