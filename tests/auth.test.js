const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/userModel");
require("dotenv").config();

describe("Auth API Endpoints", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await mongoose.connection.collection("users").deleteMany({});
  });

it("should register a new user and send an email", async () => {
  const userData = {
    email: "email@email.com",
    phone: "+17852203723", // ✅ Use E.164 format (must include +1 for US numbers)
    address: {
      street: "123 Walnut Ave.",
      city: "Perrysburg",
      state: "KS",
      zipCode: "000000",
      country: "USA", // ✅ Ensure country is included
    },
    password: "Password123",
    name: "NameofUser",
    role: "user",
    deleted: false,
  };

  const response = await request(app)
    .post("/api/v2/auth/register")
    .send(userData);

  console.log("🔍 Debug Response:", response.body); // Debugging Output

  expect(response.status).toBe(201);
  expect(response.body.message).toBe(
    "User registered successfully. Please verify your email."
  );
});

  it("should return an error if email is already taken", async () => {
    const userData = {
      email: "duplicate@example.com",
      password: "Password123",
      name: "Test User",
      phone: "1234567890",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
    };

    await User.create(userData); // Create user before test

    const response = await request(app)
      .post("/api/v2/auth/register")
      .send(userData);

    console.log("🔍 Duplicate Email Response:", response.body);

    expect(response.status).toBe(409); // ✅ Updated expected response
    expect(response.body.message).toBe("User with this email already exists.");
  });

  it("should verify the user's email with a valid token", async () => {
    const verifyEmailToken = "validToken123";

    const user = await User.create({
      email: "testusers@example.com",
      password: "Password123",
      name: "Test User",
      phone: "1234567890",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
      verification: {
        isEmailVerified: false,
        verifyEmailToken,
        verifyEmailExpires: Date.now() + 3600000,
      },
    });

    const response = await request(app)
      .post("/api/v2/auth/verify-email")
      .send({ token: verifyEmailToken });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Email verified successfully.");

    const updatedUser = await User.findOne({ email: user.email });
    expect(updatedUser.verification.isEmailVerified).toBe(true);
    expect(updatedUser.verification.verifyEmailToken).toBeNull();
    expect(updatedUser.verification.verifyEmailExpires).toBeNull();
  });

  it("should return an error for an expired token", async () => {
    const expiredToken = "expiredToken123";

    await User.create({
      email: "expireduser@example.com",
      password: "Password123",
      name: "Expired User",
      phone: "1234567890",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
      verification: {
        isEmailVerified: false,
        verifyEmailToken: expiredToken,
        verifyEmailExpires: Date.now() - 3600000,
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

  it("should resend a verification email successfully", async () => {
    const user = await User.create({
      email: "unverifieduser@example.com",
      password: "Password123",
      name: "Unverified User",
      phone: "1234567890",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
      verification: {
        isEmailVerified: false,
        verifyEmailToken: "oldToken123",
        verifyEmailExpires: Date.now() + 3600000,
      },
    });

    const response = await request(app)
      .post("/api/v2/auth/resend-verification-email")
      .send({ email: user.email });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Verification email sent successfully.");

    const updatedUser = await User.findOne({ email: user.email });
    expect(updatedUser.verification.verifyEmailToken).not.toBe("oldToken123");
    expect(
      updatedUser.verification.verifyEmailExpires.getTime()
    ).toBeGreaterThan(Date.now());
  });

  it("should return an error for already verified email", async () => {
    await User.create({
      email: "verifieduser@example.com",
      password: "Password123",
      name: "Verified User",
      phone: "1234567890",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
      verification: {
        isEmailVerified: true,
        verifyEmailToken: null,
        verifyEmailExpires: null,
      },
    });

    const response = await request(app)
      .post("/api/v2/auth/resend-verification-email")
      .send({ email: "verifieduser@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Email is already verified.");
  });

  it("should return an error for a non-existent user", async () => {
    const response = await request(app)
      .post("/api/v2/auth/resend-verification-email")
      .send({ email: "nonexistentuser@example.com" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return an error if email is not provided", async () => {
    const response = await request(app)
      .post("/api/v2/auth/resend-verification-email")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Email is required.");
  });
});