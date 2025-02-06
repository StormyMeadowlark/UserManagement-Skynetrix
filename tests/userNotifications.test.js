const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index"); // Ensure this points to your Express app
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
require("dotenv").config();

describe("User Notifications API", () => {
  let server;
  let token;
  let userId;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    server = app.listen(5002); // Start test server
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await server.close();
  });

  beforeEach(async () => {
    await mongoose.connection.collection("users").deleteMany({});

    userId = new mongoose.Types.ObjectId();
    token = `Bearer ${jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    })}`;

    await User.create({
      _id: userId,
      email: "testuser@example.com",
      password: "Password123",
      name: "Test User",
      role: "user",
      status: "Active",
      notifications: {
        email: true,
        sms: false,
        push: true,
      },
    });
  });

  /** ─────────────────────────────────────────────────
   *   GET /users/me/notifications
   * ───────────────────────────────────────────────── */

  it("should return user notification settings", async () => {
    const response = await request(app)
      .get("/api/v2/users/me/notifications")
      .set("Authorization", `${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("notifications");
    expect(response.body.notifications).toEqual({
      email: true,
      sms: false,
      push: true,
    });
  });

  it("should return default notifications if user has no notification settings", async () => {
    await User.findByIdAndUpdate(userId, { $unset: { notifications: "" } });

    const response = await request(app)
      .get("/api/v2/users/me/notifications")
      .set("Authorization", `${token}`);

    expect(response.status).toBe(200);
    expect(response.body.notifications).toEqual({
      email: false,
      sms: false,
      push: false,
    });
  });

  it("should return 404 if the user does not exist", async () => {
    await User.deleteOne({ _id: userId });

    const response = await request(app)
      .get("/api/v2/users/me/notifications")
      .set("Authorization", `${token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 401 if no authorization header is provided", async () => {
    const response = await request(app).get("/api/v2/users/me/notifications");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 500 if there is a database error", async () => {
    jest.spyOn(User, "findById").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .get("/api/v2/users/me/notifications")
      .set("Authorization", `${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Authentication failed due to a database error.");

    jest.restoreAllMocks();
  });

  /** ─────────────────────────────────────────────────
   *   PUT /users/me/notifications
   * ───────────────────────────────────────────────── */

  it("should update user notification preferences", async () => {
    const newNotifications = { email: false, sms: true, push: true };

    const response = await request(app)
      .put("/api/v2/users/me/notifications")
      .set("Authorization", `${token}`)
      .send(newNotifications);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("notifications");
    expect(response.body.notifications).toEqual(newNotifications);

    const updatedUser = await User.findById(userId);
    expect(updatedUser.notifications).toEqual(newNotifications);
  });

  it("should return 400 for invalid notification values", async () => {
    const response = await request(app)
      .put("/api/v2/users/me/notifications")
      .set("Authorization", `${token}`)
      .send({ email: "wrongType", sms: "yes", push: 1 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Invalid notification settings. All values must be true or false."
    );
  });

  it("should return 401 if no authorization header is provided", async () => {
    const response = await request(app)
      .put("/api/v2/users/me/notifications")
      .send({ email: true, sms: false, push: true });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 404 if user is not found", async () => {
    await User.deleteOne({ _id: userId });

    const response = await request(app)
      .put("/api/v2/users/me/notifications")
      .set("Authorization", `${token}`)
      .send({ email: true, sms: false, push: true });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 500 if there's a database error", async () => {
    jest.spyOn(User, "findByIdAndUpdate").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .put("/api/v2/users/me/notifications")
      .set("Authorization", `${token}`)
      .send({ email: true, sms: false, push: true });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error.");

    jest.restoreAllMocks();
  });
});
