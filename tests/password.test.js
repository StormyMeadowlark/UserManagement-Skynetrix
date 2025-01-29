const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

describe("Auth API", () => {
  let token, user;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
  });

  beforeEach(async () => {
    await User.deleteMany(); // Ensure a clean slate before each test

    user = await User.create({
      email: "testuser@example.com",
      password: "OldPassword123", // Hash password before saving
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

    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
  });

  afterEach(async () => {
    await User.deleteMany(); // Clean up after each test
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("Change Password", () => {
    it("should change the password with valid old and new passwords", async () => {
      const response = await request(app)
        .post("/api/v2/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          oldPassword: "OldPassword123",
          newPassword: "NewPassword123",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Password changed successfully.");

      const updatedUser = await User.findById(user._id);
      const isMatch = await bcrypt.compare(
        "NewPassword123",
        updatedUser.password
      );
      expect(isMatch).toBe(true);
    });

    it("should return an error if old password is incorrect", async () => {
      const response = await request(app)
        .post("/api/v2/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          oldPassword: "WrongPassword",
          newPassword: "NewPassword123",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Old password is incorrect.");
    });

    it("should return an error if new password is missing", async () => {
      const response = await request(app)
        .post("/api/v2/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          oldPassword: "OldPassword123",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Both old and new passwords are required."
      );
    });

    it("should return an error if user is not authenticated", async () => {
      const response = await request(app)
        .post("/api/v2/auth/change-password")
        .send({
          oldPassword: "OldPassword123",
          newPassword: "NewPassword123",
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized access.");
    });

    it("should return an error if user is not found", async () => {
      await User.deleteMany();

      const response = await request(app)
        .post("/api/v2/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          oldPassword: "OldPassword123",
          newPassword: "NewPassword123",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found.");
    });
  });

  describe("Forgot Password", () => {
    it("should return an error if email is not provided", async () => {
      const response = await request(app)
        .post("/api/v2/auth/forgot-password")
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email is required.");
    });

    it("should return an error if user is not found", async () => {
      const response = await request(app)
        .post("/api/v2/auth/forgot-password")
        .send({ email: "nonexistent@example.com" });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found.");
    });

    it("should generate a reset password token and send an email", async () => {
      const testUser = await User.create({
        email: "resetuser@example.com",
        password: await bcrypt.hash("Password123", 10),
        name: "Reset User",
        phone: "1234567890",
        address: {
          street: "456 Reset St",
          city: "Springfield",
          state: "IL",
          zipCode: "62701",
          country: "USA",
        },
      });

      const response = await request(app)
        .post("/api/v2/auth/forgot-password")
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "Password reset email sent successfully."
      );

      const updatedUser = await User.findOne({ email: testUser.email });
      expect(updatedUser.resetPasswordToken).toBeDefined();
      expect(updatedUser.resetPasswordExpires.getTime()).toBeGreaterThan(
        Date.now()
      );
    });
  });

  describe("Reset Password", () => {
    it("should reset the password with a valid token and new password", async () => {
      const resetPasswordToken = "validResetToken123";
      const resetPasswordExpires = Date.now() + 3600000;

      const testUser = await User.create({
        email: "resetuser@example.com",
        password: await bcrypt.hash("OldPassword123", 10),
        name: "Reset User",
        phone: "1234567890",
        address: {
          street: "456 Reset St",
          city: "Springfield",
          state: "IL",
          zipCode: "62701",
          country: "USA",
        },
        resetPasswordToken,
        resetPasswordExpires,
      });

      const response = await request(app)
        .post("/api/v2/auth/reset-password")
        .send({ token: resetPasswordToken, newPassword: "NewPassword123" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Password reset successfully.");

      const updatedUser = await User.findOne({ email: testUser.email });
      const isMatch = await bcrypt.compare(
        "NewPassword123",
        updatedUser.password
      );
      expect(isMatch).toBe(true);
      expect(updatedUser.resetPasswordToken).toBeNull();
      expect(updatedUser.resetPasswordExpires).toBeNull();
    });

    it("should return an error if the token is invalid", async () => {
      const response = await request(app)
        .post("/api/v2/auth/reset-password")
        .send({ token: "invalidToken", newPassword: "NewPassword123" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid or expired token.");
    });

    it("should return an error if the token or new password is missing", async () => {
      const response = await request(app)
        .post("/api/v2/auth/reset-password")
        .send({ newPassword: "NewPassword123" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Token and new password are required."
      );
    });
  });
});
