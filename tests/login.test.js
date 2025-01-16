const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/userModel");
require("dotenv").config();

describe("Auth API Endpoints - Login", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    // Clear the users collection after each test
    await mongoose.connection.collection("users").deleteMany({});
  });

  it("should log in a user with valid credentials", async () => {
    const email = "testuser@example.com";
    const password = "Password123";

    // Create a user
    const user = new User({ email, password, name: "Test User" });
    await user.save();

    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();

    // Validate token contains correct payload
    const tokenPayload = jwt.verify(
      response.body.token,
      process.env.JWT_SECRET
    );
    expect(tokenPayload.id).toBe(user._id.toString());
  });

  it("should return an error for invalid credentials", async () => {
    const email = "testuser@example.com";
    const password = "Password123";

    // Create a user
    const user = new User({ email, password, name: "Test User" });
    await user.save();

    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password: "WrongPassword" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials.");

    // Check that failed login attempts were incremented
    const updatedUser = await User.findOne({ email });
    expect(updatedUser.failedLoginAttempts).toBe(1);
  });

  it("should lock the account after 5 failed attempts", async () => {
    const email = "testuser@example.com";
    const password = "Password123";

    // Create a user
    const user = new User({ email, password, name: "Test User" });
    await user.save();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v2/auth/login")
        .send({ email, password: "WrongPassword" });
    }

    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Account locked. Try again later.");

    // Check account lock status
    const updatedUser = await User.findOne({ email });
    expect(updatedUser.accountLockedUntil).toBeDefined();
    expect(updatedUser.accountLockedUntil).toBeGreaterThan(Date.now());
  });

  it("should allow login after account lock expires", async () => {
    const email = "testuser@example.com";
    const password = "Password123";

    // Create a user with locked account
    const user = new User({
      email,
      password,
      name: "Test User",
      accountLockedUntil: Date.now() - 1, // Account lock expired
    });
    await user.save();

    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });

  it("should return an error if email is not found", async () => {
    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: "nonexistent@example.com", password: "Password123" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials.");
  });

  it("should return an error if no email or password is provided", async () => {
    const response = await request(app).post("/api/v2/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBeDefined();
  });
});
