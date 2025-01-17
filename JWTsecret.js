const crypto = require("crypto");

// Generate a 64-character random secret
const secret = crypto.randomBytes(64).toString("hex");
console.log("Your JWT Secret:", secret);
