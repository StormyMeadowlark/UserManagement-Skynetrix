const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const axios = require("axios");


jest.mock("axios");

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
axios.post = jest.fn().mockResolvedValue({
  data: {
    tenants: [
      { id: "tenant1", name: "Tenant One" },
      { id: "tenant2", name: "Tenant Two" },
    ],
  },
});
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
  // Ensure API Gateway URL is set
  process.env.API_GATEWAY_URL =
    process.env.API_GATEWAY_URL || "http://localhost:3000";

  axios.post.mockResolvedValue({
    data: {
      tenants: [
        { id: "tenant1", name: "Tenant One" },
        { id: "tenant2", name: "Tenant Two" },
      ],
    },
  });

  afterEach(async () => {
    await User.deleteMany();
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await mongoose.connection.close();
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

  it("should update the user profile successfully", async () => {
    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Name",
        phone: "+15555555555",
        address: {
          street: "456 Updated St",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA",
        },
        marketing: { email: true, sms: true },
        preferences: { theme: "dark", language: "fr-FR" },
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Profile updated successfully.");
    expect(response.body.user.name).toBe("Updated Name");
    expect(response.body.user.phone).toBe("+15555555555");
    expect(response.body.user.address.city).toBe("New York");
    expect(response.body.user.preferences.theme).toBe("dark");
    expect(response.body.user.preferences.language).toBe("fr-FR");
  });

  it("should not allow updating restricted fields", async () => {
    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "hacked@example.com",
        role: "admin",
        password: "NewPassword123",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBeDefined();
  });

  it("should return 400 for invalid phone number", async () => {
    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "12345" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid phone number format.");
  });

  it("should return 400 for invalid secondary phone number", async () => {
    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ secondaryPhone: "abcd1234" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Invalid secondary phone number format."
    );
  });

  it("should return 400 if theme preference is invalid", async () => {
    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ preferences: { theme: "blue" } });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid theme preference value.");
  });

  it("should return 403 if the user is inactive", async () => {
    await User.findByIdAndUpdate(user._id, { status: "Inactive" });

    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Should Not Work" });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Account is not active.");
  });

  it("should return 401 if no token is provided", async () => {
    const response = await request(app).put("/api/v2/users/me");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 401 if token is invalid", async () => {
    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", "Bearer invalidtoken")
      .send({ name: "Should Not Work" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 404 if user does not exist", async () => {
    await User.findByIdAndDelete(user._id);

    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Should Not Work" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 400 if marketing preferences are invalid", async () => {
    const response = await request(app)
      .put("/api/v2/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ marketing: { email: "yes", sms: "no" } });

    expect(response.status).toBe(400);
  });

  describe("User API - Soft Delete Account", () => {
    it("should soft delete the user account successfully", async () => {
      const response = await request(app)
        .delete("/api/v2/users/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Account deleted successfully.");

      // Verify user is marked as deleted in the database
      const deletedUser = await User.findById(user._id);
      expect(deletedUser).not.toBeNull();
      expect(deletedUser.deleted).toBe(true);
      expect(deletedUser.deletionScheduledAt).not.toBeNull();
    });

    it("should not allow an already deleted user to be deleted again", async () => {
      // Soft delete the user first
      await User.findByIdAndUpdate(user._id, { deleted: true });

      const response = await request(app)
        .delete("/api/v2/users/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Account is already deleted.");
    });

    it("should return 404 if the user does not exist", async () => {
      // Delete the user completely
      await User.findByIdAndDelete(user._id);

      const response = await request(app)
        .delete("/api/v2/users/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found.");
    });

    it("should return 401 if no token is provided", async () => {
      const response = await request(app).delete("/api/v2/users/me");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized access.");
    });

    it("should return 401 if token is invalid", async () => {
      const response = await request(app)
        .delete("/api/v2/users/me")
        .set("Authorization", "Bearer invalidtoken");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized access.");
    });
  });
});




