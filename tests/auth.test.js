const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/userModel");
require("dotenv").config();

describe("Auth API Endpoints with SendGrid", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    // Clear the users collection after each test
    await mongoose.connection.collection("users").deleteMany({});
  });

  it("should register a new user and send an email", async () => {
    const userData = {
      email: "herken.ashlee@gmail.com", // Replace with a valid email
      password: "Password123",
      name: "Test User",
      tenantDomain: "skynetrix.tech",
    };

    const response = await request(app)
      .post("/api/v2/auth/register")
      .send(userData);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      "User registered successfully. Please verify your email."
    );

    console.log("Check your email for the message sent via SendGrid.");
  });

  it("should verify the user's email with a valid token", async () => {
    const verifyEmailToken = "validToken123";

    // Create a user with a verification token
    const user = await User.create({
      email: "herken.ashlee@gmail.com",
      password: "Password123",
      name: "Test User",
      tenantDomain: "skynetrix.tech",
      verification: {
        isEmailVerified: false,
        verifyEmailToken,
        verifyEmailExpires: Date.now() + 3600000, // 1 hour in the future
      },
    });

    const response = await request(app)
      .post("/api/v2/auth/verify-email")
      .send({ token: verifyEmailToken });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Email verified successfully.");

    // Verify the user's email is marked as verified in the database
    const updatedUser = await User.findOne({ email: user.email });
    expect(updatedUser.verification.isEmailVerified).toBe(true);
    expect(updatedUser.verification.verifyEmailToken).toBeNull();
    expect(updatedUser.verification.verifyEmailExpires).toBeNull();
  });

  it("should return an error for an expired token", async () => {
    const expiredToken = "expiredToken123";

    // Create a user with an expired token
    await User.create({
      email: "expireduser@example.com",
      password: "Password123",
      name: "Expired User",
      tenantDomain: "skynetrix.tech",
      verification: {
        isEmailVerified: false,
        verifyEmailToken: expiredToken,
        verifyEmailExpires: Date.now() - 3600000, // 1 hour in the past
      },
    });

    const response = await request(app)
      .post("/api/v2/auth/verify-email")
      .send({ token: expiredToken });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid or expired token.");
  });

  it("should return an error for an invalid token", async () => {
    const response = await request(app)
      .post("/api/v2/auth/verify-email")
      .send({ token: "invalidToken789" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid or expired token.");
  });

  it("should return an error if no token is provided", async () => {
    const response = await request(app)
      .post("/api/v2/auth/verify-email")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Verification token is required.");
  });
});
