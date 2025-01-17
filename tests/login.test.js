const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/userModel");
require("dotenv").config();

describe("Auth API - Login", () => {
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
    await mongoose.connection.collection("users").deleteMany({});
  });

  it("should log in a user with valid credentials", async () => {
    const email = "testuser@example.com";
    const password = "Password123";

    // Create a user in the database
    const user = new User({
      email,
      password, // Plain text; model will hash it
      name: "Test User",
    });
    await user.save();

    // Attempt to log in
    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password }); // Send plain text password

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Login successful");
    expect(response.body.token).toBeDefined();
  });

  it("should return an error for invalid credentials", async () => {
    const email = "testuser@example.com";
    const password = "Password123";

    // Create a user in the database
    const user = new User({
      email,
      password,
      name: "Test User",
    });
    await user.save();

    // Attempt to log in with incorrect password
    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email, password: "WrongPassword" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials.");
  });
it("should return an error if no email or password is provided", async () => {
  const response = await request(app).post("/api/v2/auth/login").send({});

  // Assert status code
  expect(response.status).toBe(400);

  // Assert the structure of the errors array
  expect(response.body.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        msg: "Must be a valid email", // Match error message for 'email'
      }),
      expect.objectContaining({
        msg: "Password is required", // Match error message for 'password'
      }),
    ])
  );
});
});
