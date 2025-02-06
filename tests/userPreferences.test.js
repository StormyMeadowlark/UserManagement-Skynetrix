const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index"); // Ensure this points to your Express app
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
require("dotenv").config();

describe("GET /users/me/preferences", () => {
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
      preferences: {
        theme: "dark",
        language: "en-US",
      },
    });
  });


  it("should return 401 if no authorization header is provided", async () => {
    console.log("🔍 Testing Unauthorized Access...");

    const response = await request(app).get("/api/v2/users/me/preferences");

    console.log("🔍 Actual Response:", response.status, response.body);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized access." });
  });

  it("should return 404 if the user does not exist", async () => {
    console.log("🔍 Deleting user before test...");
    await User.deleteOne({ _id: userId });

    const response = await request(app)
      .get("/api/v2/users/me/preferences")
      .set("Authorization", `${token}`);

    console.log("🔍 User Not Found Response:", response.status, response.body);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return user preferences if the user exists", async () => {
    console.log("🔍 Fetching user preferences...");

    const response = await request(app)
      .get("/api/v2/users/me/preferences")
      .set("Authorization", `${token}`);

    console.log(
      "🔍 User Preferences Response:",
      response.status,
      response.body
    );

    expect(response.status).toBe(200);
    expect(response.body.preferences).toEqual({
      theme: "dark",
      language: "en-US",
    });
  });

  it("should return default preferences if the user has no preferences set", async () => {
    console.log("🔍 Removing preferences field for user...");

    await User.findByIdAndUpdate(userId, { preferences: {} });

    const response = await request(app)
      .get("/api/v2/users/me/preferences")
      .set("Authorization", `${token}`);

    console.log(
      "🔍 Default Preferences Response:",
      response.status,
      response.body
    );

    expect(response.status).toBe(200);
    expect(response.body.preferences).toEqual({
      theme: "system", // Default
      language: "en-US", // Default
    });
  });

it("should return 500 if there is a database error", async () => {
  console.log("🔍 Simulating database failure...");

  // ✅ Ensure authentication works first (Don't mock DB yet)
  const authResponse = await request(app)
    .get("/api/v2/users/me/preferences")
    .set("Authorization", `${token}`);

  if (authResponse.status === 401) {
    throw new Error(
      "🚨 Authentication failed: Test setup issue. Token is not working."
    );
  }

  console.log("✅ Authentication test passed. Now mocking DB error.");

  // ✅ Now mock the database failure AFTER authMiddleware passes
  jest.spyOn(User, "findById").mockImplementationOnce(async (id) => {
    if (id.toString() === userId.toString()) {
      throw new Error("Database error");
    }
    return { preferences: { theme: "dark", language: "en-US" } };
  });

  // ✅ Execute the request again (now with the mock)
  const response = await request(app)
    .get("/api/v2/users/me/preferences")
    .set("Authorization", `${token}`);

  console.log("🔍 Database Error Response:", response.status, response.body);

  // ✅ Expect 500 since the failure is now occurring within the controller
  expect(response.status).toBe(500);
  expect(response.body.message).toBe("Authentication failed due to a database error.");

  jest.restoreAllMocks(); // ✅ Reset mocks after test
});







  it("should update user preferences", async () => {
    const newPreferences = {
      theme: "light",
      language: "fr-FR",
    };

    const response = await request(app)
      .put("/api/v2/users/me/preferences")
      .set("Authorization", `${token}`)
      .send(newPreferences);

    expect(response.status).toBe(200);
    expect(response.body.preferences).toEqual(newPreferences);

    const updatedUser = await User.findById(userId);
    expect(updatedUser.preferences.theme).toBe("light");
    expect(updatedUser.preferences.language).toBe("fr-FR");
  });

  it("should return 400 for invalid theme", async () => {
    const response = await request(app)
      .put("/api/v2/users/me/preferences")
      .set("Authorization", `${token}`)
      .send({ theme: "invalid-theme" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid theme selected.");
  });

  it("should return 400 for invalid language format", async () => {
    const response = await request(app)
      .put("/api/v2/users/me/preferences")
      .set("Authorization", `${token}`)
      .send({ language: 12345 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid language format.");
  });

  it("should return 404 if user is not found when updating preferences", async () => {
    await User.deleteOne({ _id: userId });

    const response = await request(app)
      .put("/api/v2/users/me/preferences")
      .set("Authorization", `${token}`)
      .send({ theme: "light" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 500 if there's a database error when updating preferences", async () => {
    jest.spyOn(User, "findByIdAndUpdate").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .put("/api/v2/users/me/preferences")
      .set("Authorization", `${token}`)
      .send({ theme: "dark" });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error.");

    jest.restoreAllMocks(); // Reset mocks after test
  });

});
