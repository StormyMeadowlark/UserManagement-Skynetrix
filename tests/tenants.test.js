jest.mock("axios");
const request = require("supertest");
const app = require("../index");
const axios = require("axios");

describe("Tenant Management API - Admin Only", () => {
  let adminToken, tenantId, userId;

  beforeEach(() => {
    tenantId = "67a4d4566aac7948a3b01100";
    userId = "67a4d4566aac7948a3b01104";

    adminToken = `Bearer some-admin-token`;
  });

  it("should fetch users for a tenant", async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: { users: [{ id: userId, name: "John Doe" }] },
    });

    const response = await request(app)
      .get(`/api/v2/tenants/${tenantId}/users`)
      .set("Authorization", adminToken);

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0].name).toBe("John Doe");
  });

  it("should add a user to a tenant", async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: { message: "User added successfully" },
    });

    const response = await request(app)
      .post(`/api/v2/tenants/${tenantId}/users`)
      .set("Authorization", adminToken)
      .send({ userId });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User added successfully");
  });

  it("should remove a user from a tenant", async () => {
    axios.delete.mockResolvedValue({
      status: 200,
      data: { message: "User removed successfully" },
    });

    const response = await request(app)
      .delete(`/api/v2/tenants/${tenantId}/users/${userId}`)
      .set("Authorization", adminToken);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User removed successfully");
  });

  it("should return 401 if no token is provided", async () => {
    const response = await request(app).get(
      `/api/v2/tenants/${tenantId}/users`
    );
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized access.");
  });

  it("should return 403 if a non-admin tries to access", async () => {
    const userToken = `Bearer some-user-token`;

    const response = await request(app)
      .get(`/api/v2/tenants/${tenantId}/users`)
      .set("Authorization", userToken);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Access denied. Admins only.");
  });

  it("should return 500 if the API Gateway fails", async () => {
    axios.get.mockRejectedValue({
      response: { status: 500, data: { message: "Error forwarding request" } },
    });

    const response = await request(app)
      .get(`/api/v2/tenants/${tenantId}/users`)
      .set("Authorization", adminToken);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Error forwarding request");
  });
});
