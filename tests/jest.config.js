require("dotenv").config({ path: ".env.test" });

module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["./tests/setup.js"],
};
