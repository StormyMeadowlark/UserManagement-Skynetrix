const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const axios = require("axios");

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Retrieved from JWT token

    // Fetch user data from the database
    const user = await User.findById(userId).select("-password"); // Exclude sensitive fields like password

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Fetch tenant details from the tenant microservice
    let tenantDetails = [];
    if (user.tenantIds && user.tenantIds.length > 0) {
      try {
        const response = await axios.post(
          `${process.env.TENANT_SERVICE_URL}/tenants/`,
          {
            tenantIds: user.tenantIds,
          }
        );
        tenantDetails = response.data.tenants || [];
      } catch (err) {
        console.error("Error fetching tenants:", err.message);
      }
    }

    // Build the profile response
    const profile = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      secondaryPhone: user.secondaryPhone || null,
      address: user.address || null,
      birthday: user.birthday || null,
      marketing: {
        email: user.marketing?.email || false,
        sms: user.marketing?.sms || false,
      },
      role: user.role,
      tenants: tenantDetails, // Fetched from the tenant microservice
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled || false,
      vehicles: [], // Placeholder for future integration
    };

    // Send the response
    res.status(200).json({ profile });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};