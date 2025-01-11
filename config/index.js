const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000, // Server port
  MONGO_URI: process.env.MONGO_URI, // MongoDB connection URI
  JWT_SECRET: process.env.JWT_SECRET, // JWT secret for authentication
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1h", // Token expiration time
};
