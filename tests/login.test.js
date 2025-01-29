const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
require("dotenv").config();

describe("Auth API - Login", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await mongoose.connection.collection("users").deleteMany({});
  });

  it("should log in a user with valid credentials and verified email", async () => {
    const email = "testuser2@example.com";
    const password = "Password123";


    const user = new User({
      email,
      password: password,
      name: "Test User",
      verification: { isEmailVerified: true }, // Email is verified
      phone: "1234567890", // Required phone
      address: {
        // Required address fields
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
    });
    await user.save();

    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Login successful");
    expect(response.body.token).toBeDefined();
  });

  it("should return an error for unverified email", async () => {
    const email = "testuser@example.com";
    const password = "Password123";

    const user = new User({
      email,
      password: password,
      name: "Test User",
      verification: { isEmailVerified: false }, // Email is NOT verified
      phone: "1234567890",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
    });
    await user.save();

    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "Please verify your email before logging in."
    );
  });

  it("should return an error for invalid credentials", async () => {
    const email = "testuser@example.com";
    const password = "Password123";

    const user = new User({
      email,
      password: password,
      name: "Test User",
      verification: { isEmailVerified: true },
      phone: "1234567890",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
    });
    await user.save();

    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password: "WrongPassword" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials.");
  });

  it("should return an error if no email or password is provided", async () => {
    const response = await request(app).post("/api/v2/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: "Must be a valid email",
        }),
        expect.objectContaining({
          msg: "Password is required",
        }),
      ])
    );
  });

  it("should respond with a successful logout message", async () => {
    // Simulate a logout request
    const response = await request(app).post("/api/v2/auth/logout");

    // Assert the response status and message
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Logout successful.");
  });
});
