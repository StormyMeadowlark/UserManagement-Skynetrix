const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../index"); // Ensure this points to your Express app
const User = require("../models/userModel");

// Mock axios to prevent real API calls
jest.mock("axios");
const axios = require("axios");

// Mock email service
jest.mock("../utils/email");
const { sendEmail } = require("../utils/email");

let mongoServer;

// 🔹 Setup In-Memory MongoDB for Testing
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

// 🔹 Clean up after each test
afterEach(async () => {
  await User.deleteMany({});
  jest.clearAllMocks();
});

// 🔹 Disconnect from MongoDB after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// 🔹 Mock Data
const API_URL = "/api/v2/auth/register";

const mockTenant = {
  success: true,
  tenant: {
    _id: "tenant123",
    shopware: {
      enabled: true,
      tenantId: "5722", // ✅ Real Shopware tenant ID
      importAddress: false,
    },
    mainAddress: { zip: "66604" }, // ✅ Used if importAddress is false
  },
};

const mockShopwareCustomer = {
  data: {
    data: [{ id: "existing-shopware-id", phone: "1234567890" }],
  },
};

const newUserData = {
  email: "test@example.com",
  password: "SecurePass123!",
  name: "John Doe",
  phone: "1234567890",
  birthday: "1990-01-01",
  marketing: true,
  businessName: "John's Auto",
  address: "123 Main St",
  city: "Topeka",
  state: "KS",
  zip: "66604",
};

// 🔹 Begin Tests
describe("User Registration", () => {
  test("✅ Successfully registers a new user (Shopware customer exists)", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/domain/"))
        return Promise.resolve({ data: mockTenant });
      if (url.includes(`/tenants/5722/customers?phone_number=`))
        return Promise.resolve(mockShopwareCustomer);
      return Promise.reject(new Error(`Unexpected API call to ${url}`));
    });

    console.log("🔹 Sending registration request:", newUserData);
    const res = await request(app)
      .post(API_URL)
      .set("Origin", "http://example.com") // ✅ FIXED: Add Origin header
      .send(newUserData);
    console.log("🔹 Response:", res.status, res.body);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe(
      "User registered successfully. Please verify your email."
    );
    expect(res.body.shopwareUserId).toBe("existing-shopware-id");
  });

  test("✅ Registers a new user and creates Shopware customer (if not found)", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/domain/"))
        return Promise.resolve({ data: mockTenant });
      if (url.includes(`/tenants/5722/customers?phone_number=`))
        return Promise.resolve({ data: { data: [] } }); // No customer found
      return Promise.reject(new Error(`Unexpected API call to ${url}`));
    });

    axios.post.mockImplementation((url, payload) => {
      if (url.includes("/tenants/5722/customers")) {
        expect(payload.zip).toBe("66604"); // ✅ Correct ZIP used
        return Promise.resolve({
          status: 201,
          data: { id: "new-shopware-id" },
        });
      }
      return Promise.reject(new Error(`Unexpected POST request to ${url}`));
    });

    const res = await request(app)
      .post(API_URL)
      .set("Origin", "http://example.com") // ✅ FIXED: Add Origin header
      .send(newUserData);
    expect(res.status).toBe(201);
    expect(res.body.shopwareUserId).toBe("new-shopware-id");
  });

  test("✅ Uses tenant ZIP if importAddress is false", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/domain/"))
        return Promise.resolve({ data: mockTenant });
      if (url.includes(`/tenants/5722/customers?phone_number=`))
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`Unexpected API call to ${url}`));
    });

    axios.post.mockImplementation((url, payload) => {
      expect(payload.zip).toBe("66604"); // ✅ Should use tenant ZIP
      return Promise.resolve({ status: 201, data: { id: "new-shopware-id" } });
    });

    const res = await request(app)
      .post(API_URL)
      .set("Origin", "http://example.com") // ✅ FIXED: Add Origin header
      .send(newUserData);
    expect(res.status).toBe(201);
  });

  test("❌ Rejects registration if email is already in use", async () => {
    await new User({ ...newUserData, shopwareUserId: "existing-id" }).save();

    const res = await request(app)
      .post(API_URL)
      .set("Origin", "http://example.com") // ✅ FIXED: Add Origin header
      .send(newUserData);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("User with this email already exists.");
  });

  test("❌ Fails when tenant is not found", async () => {
    axios.get.mockResolvedValue({ data: { success: false } });

    const res = await request(app)
      .post(API_URL)
      .set("Origin", "http://example.com") // ✅ FIXED: Add Origin header
      .send(newUserData);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Tenant not found.");
  });

  test("❌ Fails when Shopware API is down", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/domain/"))
        return Promise.resolve({ data: mockTenant });
      if (url.includes(`/tenants/5722/customers?phone_number=`))
        return Promise.reject(new Error("Shopware API Down"));
      return Promise.reject(new Error(`Unexpected API call to ${url}`));
    });

    const res = await request(app)
      .post(API_URL)
      .set("Origin", "http://example.com") // ✅ FIXED: Add Origin header
      .send(newUserData);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Shopware API failure.");
  });

  test("✅ Sends verification email on successful registration", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/domain/"))
        return Promise.resolve({ data: mockTenant });
      if (url.includes(`/tenants/5722/customers?phone_number=`))
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`Unexpected API call to ${url}`));
    });

    axios.post.mockResolvedValue({
      status: 201,
      data: { id: "new-shopware-id" },
    });

    const res = await request(app)
      .post(API_URL)
      .set("Origin", "http://example.com") // ✅ FIXED: Add Origin header
      .send(newUserData);
    expect(res.status).toBe(201);
    expect(sendEmail).toHaveBeenCalled();
  });
});
