const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

module.exports = redis;
