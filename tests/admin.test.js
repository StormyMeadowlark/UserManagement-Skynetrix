const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index"); // Ensure this points to your Express app
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
require("dotenv").config();

describe("GET /users - Admin Only", () => {
  let server;
  let token;
  let adminId;

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

  // Explicitly create users first
  adminId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  await User.create([
    {
      _id: adminId, // Explicitly set _id
      email: "admin@example.com",
      password: "Password123",
      name: "Admin User",
      role: "admin",
      status: "Active",
    },
    {
      _id: userId, // Explicitly set _id
      email: "user1@example.com",
      password: "Password123",
      name: "User One",
      role: "user",
      status: "Active",
    },
  ]);

  // Generate a valid token using the correct admin ID
  token = `Bearer ${jwt.sign(
    { id: adminId, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  )}`;

  // Generate a valid token using the correct user ID
  userToken = `Bearer ${jwt.sign(
    { id: userId, role: "user" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  )}`;
});

it("should return 403 if a non-admin tries to access", async () => {
  const response = await request(app)
    .get("/api/v2/admin/users") // Ensure this matches `adminRoutes.js`
    .set("Authorization", userToken); // Use the correct `userToken`

  console.log(
    "❌ TEST FAILED RESPONSE (403 EXPECTED):",
    response.status,
    response.body
  );

  expect(response.status).toBe(403);
  expect(response.body.message).toBe("Access denied. Admins only.");
});


it("should return 404 if no users exist", async () => {
  await User.deleteMany(); // Remove all users

  const response = await request(app)
    .get("/api/v2/admin/users") // Ensure this matches your admin route
    .set("Authorization", token); // Use the correct admin token

  console.log(
    "❌ TEST FAILED RESPONSE (404 EXPECTED):",
    response.status,
    response.body
  );

  expect(response.status).toBe(404); // ✅ Expect 404 now
  expect(response.body.message).toBe("User not found.");
});

  it("should return all users for an admin", async () => {
    const response = await request(app)
      .get("/api/v2/admin/users")
      .set("Authorization", `${token}`);

    console.log("📢 RESPONSE BODY:", response.body);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("users");
    expect(response.body.users.length).toBe(2); // Should return all users
    expect(response.body.users[0]).not.toHaveProperty("password"); // Ensure passwords are excluded
  });

  it("should return 401 if no authorization token is provided", async () => {
    const response = await request(app).get("/api/v2/admin/users");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 500 if there's a database error", async () => {
    jest.spyOn(User, "find").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .get("/api/v2/admin/users")
      .set("Authorization", `${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error.");

    jest.restoreAllMocks();
  });
  describe("GET /users/search - Admin Only", () => {
    it("should return users matching the search query", async () => {
      const response = await request(app)
        .get("/api/v2/admin/users/search?name=Admin") // Partial match on name
        .set("Authorization", token);

      console.log("📢 SEARCH RESPONSE BODY:", response.body);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBe(1); // Should return only the admin
      expect(response.body.users[0].name).toContain("Admin");
      expect(response.body.users[0]).not.toHaveProperty("password"); // Ensure passwords are excluded
    });

    it("should return 404 if no matching users are found", async () => {
      const response = await request(app)
        .get("/api/v2/admin/users/search?name=NonExistent")
        .set("Authorization", token);

      console.log("📢 SEARCH 404 RESPONSE:", response.body);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("No matching users found.");
    });

    it("should return 401 if no authorization token is provided", async () => {
      const response = await request(app).get(
        "/api/v2/admin/users/search?name=Admin"
      );

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized access.");
    });

    it("should return 403 if a non-admin tries to search", async () => {
      const response = await request(app)
        .get("/api/v2/admin/users/search?name=Admin")
        .set("Authorization", userToken); // Non-admin user

      console.log("📢 SEARCH 403 RESPONSE:", response.body);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Access denied. Admins only.");
    });

    it("should handle invalid query parameters gracefully", async () => {
      const response = await request(app)
        .get("/api/v2/admin/users/search?invalidParam=123")
        .set("Authorization", token);

      console.log("📢 SEARCH INVALID PARAM RESPONSE:", response.body);

      expect(response.status).toBe(200); // Should still return results or empty array
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it("should return 500 if there's a database error", async () => {
      jest.spyOn(User, "find").mockImplementationOnce(() => {
        throw new Error("Database error");
      });

      const response = await request(app)
        .get("/api/v2/admin/users/search?name=Admin")
        .set("Authorization", token);

      console.log("📢 SEARCH 500 RESPONSE:", response.body);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Internal server error.");

      jest.restoreAllMocks();
    });
  });
describe("GET /users/:id - Admin Only", () => {
  let userToFetchId;

  beforeEach(async () => {
    // Create another user to test fetching by ID
    const user = await User.create({
      email: "testuser@example.com",
      password: "Password123",
      name: "Test User",
      role: "user",
      status: "Active",
    });

    userToFetchId = user._id.toString(); // Store this ID for testing
  });

  it("should return the correct user when a valid ID is provided", async () => {
    const response = await request(app)
      .get(`/api/v2/admin/users/${userToFetchId}`)
      .set("Authorization", token);

    console.log("📢 FETCH USER RESPONSE BODY:", response.body);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("user");
    expect(response.body.user._id).toBe(userToFetchId);
    expect(response.body.user).not.toHaveProperty("password"); // Ensure passwords are excluded
  });

  it("should return 404 if the user is not found", async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString(); // Generate a random ObjectId

    const response = await request(app)
      .get(`/api/v2/admin/users/${nonExistentUserId}`)
      .set("Authorization", token);

    console.log("📢 FETCH NON-EXISTENT USER RESPONSE:", response.body);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 400 if an invalid user ID format is provided", async () => {
    const response = await request(app)
      .get("/api/v2/admin/users/invalidUserId")
      .set("Authorization", token);

    console.log("📢 FETCH INVALID ID RESPONSE:", response.body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user ID format.");
  });

  it("should return 401 if no authorization token is provided", async () => {
    const response = await request(app).get(
      `/api/v2/admin/users/${userToFetchId}`
    );

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 403 if a non-admin tries to fetch a user", async () => {
    const response = await request(app)
      .get(`/api/v2/admin/users/${userToFetchId}`)
      .set("Authorization", userToken); // Non-admin user

    console.log("📢 FETCH USER 403 RESPONSE:", response.body);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Access denied. Admins only.");
  });

  it("should return 500 if there's a database error", async () => {
    jest.spyOn(User, "findById").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .get(`/api/v2/admin/users/${userToFetchId}`)
      .set("Authorization", token);

    console.log("📢 FETCH USER 500 RESPONSE:", response.body);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Authentication failed due to a database error.");

    jest.restoreAllMocks();
  });
});
describe("PUT /users/:id - Admin Only", () => {
  let userToUpdateId;

  beforeEach(async () => {
    // Create another user to test updating by ID
    const user = await User.create({
      email: "testupdate@example.com",
      password: "Password123",
      name: "Test Update User",
      role: "user",
      status: "Active",
    });

    userToUpdateId = user._id.toString(); // Store this ID for testing
  });

  it("should allow an admin to update a user profile", async () => {
    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}`)
      .set("Authorization", token)
      .send({
        name: "Updated Name",
        email: "updatedemail@example.com",
        status: "Suspended",
      });

    console.log("📢 UPDATE USER RESPONSE BODY:", response.body);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      "message",
      "User profile updated successfully."
    );
    expect(response.body.user.name).toBe("Updated Name");
    expect(response.body.user.email).toBe("updatedemail@example.com");
    expect(response.body.user.status).toBe("Suspended");
  });

  it("should not allow updating restricted fields", async () => {
    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}`)
      .set("Authorization", token)
      .send({
        password: "NewPassword123",
        twoFactorSecret: "newSecret",
        resetPasswordToken: "resetToken",
        deleted: true,
        status: "Inactive",
      });

    console.log("📢 UPDATE RESTRICTED FIELD RESPONSE:", response.body);

    expect(response.status).toBe(200);
    expect(response.body.user.status).toBe("Inactive"); // ✅ Allowed update
    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("twoFactorSecret");
    expect(response.body.user).not.toHaveProperty("resetPasswordToken");
    expect(response.body.user.deleted).toBeFalsy(); // ✅ Should remain false
  });

  it("should return 403 if a non-admin tries to update a user", async () => {
    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}`)
      .set("Authorization", userToken)
      .send({ name: "Unauthorized Update" });

    console.log("📢 UPDATE USER 403 RESPONSE:", response.body);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Access denied. Admins only.");
  });

  it("should return 404 if the user to update is not found", async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString(); // Generate a random ObjectId

    const response = await request(app)
      .put(`/api/v2/admin/users/${nonExistentUserId}`)
      .set("Authorization", token)
      .send({ name: "Nonexistent User" });

    console.log("📢 UPDATE NON-EXISTENT USER RESPONSE:", response.body);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 400 if an invalid user ID format is provided", async () => {
    const response = await request(app)
      .put("/api/v2/admin/users/invalidUserId")
      .set("Authorization", token)
      .send({ name: "Invalid ID" });

    console.log("📢 UPDATE INVALID ID RESPONSE:", response.body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user ID format.");
  });

  it("should return 401 if no authorization token is provided", async () => {
    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}`)
      .send({ name: "No Token Update" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 500 if there's a database error", async () => {
    jest.spyOn(User, "findByIdAndUpdate").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}`)
      .set("Authorization", token)
      .send({ name: "Database Error" });

    console.log("📢 UPDATE USER 500 RESPONSE:", response.body);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error.");

    jest.restoreAllMocks();
  });
});
describe("DELETE /users/:id - Admin Only", () => {
  let userToDeleteId;

  beforeEach(async () => {
    // Create another user to test deleting
    const user = await User.create({
      email: "deleteuser@example.com",
      password: "Password123",
      name: "User To Delete",
      role: "user",
      status: "Active",
    });

    userToDeleteId = user._id.toString(); // Store this ID for testing
  });

  it("should allow an admin to delete a user", async () => {
    const response = await request(app)
      .delete(`/api/v2/admin/users/${userToDeleteId}`)
      .set("Authorization", token); // Admin token

    console.log("📢 DELETE USER RESPONSE BODY:", response.body);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User deleted successfully.");

    // Ensure user is removed from the database
    const deletedUser = await User.findById(userToDeleteId);
    expect(deletedUser).toBeNull();
  });

  it("should return 403 if a non-admin tries to delete a user", async () => {
    const response = await request(app)
      .delete(`/api/v2/admin/users/${userToDeleteId}`)
      .set("Authorization", userToken); // Non-admin user token

    console.log("📢 DELETE USER 403 RESPONSE:", response.body);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Access denied. Admins only.");
  });

  it("should return 404 if the user is not found", async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString(); // Generate a random ObjectId

    const response = await request(app)
      .delete(`/api/v2/admin/users/${nonExistentUserId}`)
      .set("Authorization", token);

    console.log("📢 DELETE NON-EXISTENT USER RESPONSE:", response.body);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 400 if an invalid user ID format is provided", async () => {
    const response = await request(app)
      .delete("/api/v2/admin/users/invalidUserId")
      .set("Authorization", token);

    console.log("📢 DELETE INVALID ID RESPONSE:", response.body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user ID format.");
  });

  it("should return 401 if no authorization token is provided", async () => {
    const response = await request(app).delete(
      `/api/v2/admin/users/${userToDeleteId}`
    );

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 500 if there's a database error", async () => {
    jest.spyOn(User, "findByIdAndDelete").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .delete(`/api/v2/admin/users/${userToDeleteId}`)
      .set("Authorization", token);

    console.log("📢 DELETE USER 500 RESPONSE:", response.body);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error.");

    jest.restoreAllMocks();
  });
});

describe("GET /users/:id/roles - Admin Only", () => {
  let userToFetchId, tenantId;

  beforeEach(async () => {
    // Create a user with a tenant association
    tenantId = new mongoose.Types.ObjectId(); // Generate a tenant ID

    const user = await User.create({
      email: "userroles@example.com",
      password: "Password123",
      name: "User Roles",
      role: "user",
      status: "Active",
      tenantIds: [tenantId], // Assign user to a tenant
    });

    userToFetchId = user._id.toString(); // Store user ID for testing
  });

  it("should allow an admin to fetch user roles globally", async () => {
    const response = await request(app)
      .get(`/api/v2/admin/users/${userToFetchId}/roles`)
      .set("Authorization", token);

    console.log("📢 FETCH USER ROLES RESPONSE BODY:", response.body);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("roles");
    expect(response.body.roles).toContain("user"); // Check user role
  });

  it("should allow an admin to fetch user roles scoped by tenant", async () => {
    const response = await request(app)
      .get(`/api/v2/admin/users/${userToFetchId}/roles?tenantId=${tenantId}`)
      .set("Authorization", token);

    console.log("📢 FETCH USER ROLES (TENANT) RESPONSE BODY:", response.body);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("roles");
    expect(response.body.roles).toContain("user");
    expect(response.body).toHaveProperty("tenantId", tenantId.toString());
  });

  it("should return 403 if the user does not belong to the specified tenant", async () => {
    const differentTenantId = new mongoose.Types.ObjectId().toString(); // Different tenant

    const response = await request(app)
      .get(
        `/api/v2/admin/users/${userToFetchId}/roles?tenantId=${differentTenantId}`
      )
      .set("Authorization", token);

    console.log("📢 FETCH USER ROLES 403 RESPONSE:", response.body);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("User does not belong to this tenant.");
  });

  it("should return 404 if the user is not found", async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString(); // Generate a random ObjectId

    const response = await request(app)
      .get(`/api/v2/admin/users/${nonExistentUserId}/roles`)
      .set("Authorization", token);

    console.log("📢 FETCH NON-EXISTENT USER ROLES RESPONSE:", response.body);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 400 if an invalid user ID format is provided", async () => {
    const response = await request(app)
      .get("/api/v2/admin/users/invalidUserId/roles")
      .set("Authorization", token);

    console.log("📢 FETCH INVALID ID RESPONSE:", response.body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user ID format.");
  });

  it("should return 401 if no authorization token is provided", async () => {
    const response = await request(app).get(
      `/api/v2/admin/users/${userToFetchId}/roles`
    );

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 403 if a non-admin tries to fetch roles", async () => {
    const response = await request(app)
      .get(`/api/v2/admin/users/${userToFetchId}/roles`)
      .set("Authorization", userToken); // Non-admin user

    console.log("📢 FETCH USER ROLES 403 RESPONSE:", response.body);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Access denied. Admins only.");
  });

  it("should return 500 if there's a database error", async () => {
    jest.spyOn(User, "findById").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .get(`/api/v2/admin/users/${userToFetchId}/roles`)
      .set("Authorization", token);

    console.log("📢 FETCH USER ROLES 500 RESPONSE:", response.body);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Authentication failed due to a database error.");

    jest.restoreAllMocks();
  });
});
describe("PUT /users/:id/roles - Admin Only", () => {
  let userToUpdateId;

  beforeEach(async () => {
    // Create another user to test updating their roles
    const user = await User.create({
      email: "roleupdate@example.com",
      password: "Password123",
      name: "User Role Update",
      role: "user",
      status: "Active",
    });

    userToUpdateId = user._id.toString(); // Store this ID for testing
  });

  it("should allow an admin to update a user's role", async () => {
    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}/roles`)
      .set("Authorization", token) // Admin token
      .send({ role: "tenantAdmin" });

    console.log("📢 UPDATE USER ROLE RESPONSE BODY:", response.body);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User role updated successfully.");
    expect(response.body.user.role).toBe("tenantAdmin");
  });

  it("should return 400 if an invalid role is provided", async () => {
    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}/roles`)
      .set("Authorization", token)
      .send({ role: "invalidRole" });

    console.log("📢 UPDATE USER INVALID ROLE RESPONSE:", response.body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Invalid role. Allowed roles: user, admin, tenantAdmin."
    );
  });

  it("should return 403 if a non-admin tries to update a user's role", async () => {
    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}/roles`)
      .set("Authorization", userToken) // Non-admin token
      .send({ role: "admin" });

    console.log("📢 UPDATE USER ROLE 403 RESPONSE:", response.body);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Access denied. Admins only.");
  });

  it("should return 404 if the user to update is not found", async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString();

    const response = await request(app)
      .put(`/api/v2/admin/users/${nonExistentUserId}/roles`)
      .set("Authorization", token)
      .send({ role: "admin" });

    console.log("📢 UPDATE NON-EXISTENT USER ROLE RESPONSE:", response.body);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 400 if an invalid user ID format is provided", async () => {
    const response = await request(app)
      .put("/api/v2/admin/users/invalidUserId/roles")
      .set("Authorization", token)
      .send({ role: "admin" });

    console.log("📢 UPDATE USER ROLE INVALID ID RESPONSE:", response.body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user ID format.");
  });

  it("should return 401 if no authorization token is provided", async () => {
    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}/roles`)
      .send({ role: "admin" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 500 if there's a database error", async () => {
    jest.spyOn(User, "findByIdAndUpdate").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .put(`/api/v2/admin/users/${userToUpdateId}/roles`)
      .set("Authorization", token)
      .send({ role: "admin" });

    console.log("📢 UPDATE USER ROLE 500 RESPONSE:", response.body);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error.");

    jest.restoreAllMocks();
  });
});
});