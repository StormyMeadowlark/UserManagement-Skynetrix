const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../index");
const User = require("../models/userModel");

require("dotenv").config();

describe("Auth API - Refresh Token", () => {
  let user, verifiedUser, unverifiedUser, refreshToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
  });

  beforeEach(async () => {
    await User.deleteMany(); // Ensure a clean slate before each test

    // Create a test user with required fields
    user = await User.create({
      email: "testuser@example.com",
      password: "Password123",
      name: "Test User",
      phone: "1234567890", // ✅ Required phone field
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
    });

    verifiedUser = await User.create({
      email: "verifieduser@example.com",
      password: "Password123",
      name: "Verified User",
      phone: "1234567890",
      address: {
        street: "456 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
      verification: {
        isEmailVerified: true,
      },
    });

    unverifiedUser = await User.create({
      email: "unverifieduser@example.com",
      password: "Password123",
      name: "Unverified User",
      phone: "1234567890",
      address: {
        street: "789 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
      verification: {
        isEmailVerified: false,
      },
    });

    // Generate a valid refresh token for verified user
    refreshToken = jwt.sign({ id: verifiedUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  });

  afterEach(async () => {
    await User.deleteMany(); // Clean up after each test
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should refresh the token for a verified user", async () => {
    const response = await request(app)
      .post("/api/v2/auth/refresh-token")
      .send({ token: refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Token refreshed successfully.");
    expect(response.body.token).toBeDefined();
  });

  it("should reject refresh for an unverified user", async () => {
    const unverifiedToken = jwt.sign(
      { id: unverifiedUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const response = await request(app)
      .post("/api/v2/auth/refresh-token")
      .send({ token: unverifiedToken });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "Please verify your email to use this feature."
    );
  });

  it("should return an error if no refresh token is provided", async () => {
    const response = await request(app)
      .post("/api/v2/auth/refresh-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Refresh token is required.");
  });

  it("should return an error for an invalid refresh token", async () => {
    const response = await request(app)
      .post("/api/v2/auth/refresh-token")
      .send({ token: "invalid-token" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid or expired refresh token.");
  });
});
