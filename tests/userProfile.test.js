const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
require("dotenv").config();

describe("User API - Get Profile", () => {
  let token, user;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);

    // Create a test user with correct address and phone fields
    user = await User.create({
      email: "testuser@example.com",
      phone: "1234567890", // Correct E.164 format
      secondaryPhone: "+19876543210", // Optional
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
      password: "Password123",
      name: "Test User",
      birthday: "1990-01-01",
      marketing: { email: true, sms: false },
      role: "user",
      status: "Active",
      twoFactorEnabled: true,
    });

    // Generate a valid JWT for the user
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
beforeEach(async () => {
  // Clean previous users
  await User.deleteMany();

  // Create new user for each test
  user = await User.create({
    email: "testuser@example.com",
    phone: "1234567890",
    address: {
      street: "123 Main St",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
      country: "USA",
    },
    password: "Password123",
    name: "Test User",
    role: "user",
    status: "Active",
    twoFactorEnabled: true,
  });

  // Generate fresh token for each test
  token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
});
  afterEach(async () => {
    await User.deleteMany();
  });

  it("should retrieve the user profile successfully", async () => {
    const response = await request(app)
      .get("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.profile).toBeDefined();
    expect(response.body.profile.email).toBe(user.email);
    expect(response.body.profile.name).toBe(user.name);
    expect(response.body.profile.phone).toBe(user.phone);
    expect(response.body.profile.address.street).toBe("123 Main St");
    expect(response.body.profile.address.city).toBe("Springfield");
    expect(response.body.profile.address.state).toBe("IL");
    expect(response.body.profile.address.zipCode).toBe("62701");
    expect(response.body.profile.address.country).toBe("USA");
    expect(response.body.profile.role).toBe("user");
    expect(response.body.profile.twoFactorEnabled).toBe(true);
  });

  it("should return 404 if the user is not found", async () => {
    // Delete the user to simulate missing user
    await User.findByIdAndDelete(user._id);

    const response = await request(app)
      .get("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 401 if no token is provided", async () => {
    const response = await request(app).get("/api/v2/users/me");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

it("should return 404 if the user is not found", async () => {
  // Delete user before sending request
  await User.findByIdAndDelete(user._id);

  const response = await request(app)
    .get("/api/v2/users/me")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404); // ✅ Now correctly returns 404
  expect(response.body.message).toBe("User not found.");
});
});
