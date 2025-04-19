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

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Retrieved from JWT token
    const updateData = req.body;

    // Prevent updating restricted fields
    const restrictedFields = [
      "email",
      "password",
      "role",
      "status",
      "verification",
      "twoFactorSecret",
      "resetPasswordToken",
      "resetPasswordExpires",
      "accountLockedUntil",
      "failedLoginAttempts",
      "createdBy",
      "updatedBy",
      "deleted",
      "tenantIds",
    ];

    // Ensure restricted fields are not being updated
    const attemptedRestrictedFields = Object.keys(updateData).filter((field) =>
      restrictedFields.includes(field)
    );

    if (attemptedRestrictedFields.length > 0) {
      return res.status(400).json({
        message: `Updating these fields is not allowed: ${attemptedRestrictedFields.join(
          ", "
        )}`,
      });
    }

    // Validate phone numbers if provided
    if (updateData.phone) {
      console.log("Received phone data:", updateData.phone); // Debugging

      // Convert to string and trim whitespace
      updateData.phone = String(updateData.phone).trim();

      // Ensure phone number is in E.164 format (must be at least 10 digits)
      if (!/^\+?[1-9]\d{9,14}$/.test(updateData.phone)) {
        return res
          .status(400)
          .json({ message: "Invalid phone number format." });
      }
    }

    if (updateData.secondaryPhone) {
      console.log("Received secondary phone data:", updateData.secondaryPhone); // Debugging

      updateData.secondaryPhone = String(updateData.secondaryPhone).trim();

      if (!/^\+?[1-9]\d{9,14}$/.test(updateData.secondaryPhone)) {
        return res
          .status(400)
          .json({ message: "Invalid secondary phone number format." });
      }
    }

    // Ensure marketing preferences are boolean values if provided
    if (updateData.marketing) {
      if (typeof updateData.marketing.email !== "undefined") {
        if (typeof updateData.marketing.email !== "boolean") {
          return res
            .status(400)
            .json({ message: "Email marketing preference must be a boolean." });
        }
      }
      if (typeof updateData.marketing.sms !== "undefined") {
        if (typeof updateData.marketing.sms !== "boolean") {
          return res
            .status(400)
            .json({ message: "SMS marketing preference must be a boolean." });
        }
      }
    }

    // Ensure preferences are valid
    if (updateData.preferences) {
      if (
        updateData.preferences.theme &&
        !["light", "dark", "system"].includes(updateData.preferences.theme)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid theme preference value." });
      }

      if (
        updateData.preferences.language &&
        (typeof updateData.preferences.language !== "string" ||
          !/^[a-z]{2}-[A-Z]{2}$/.test(updateData.preferences.language))
      ) {
        return res.status(400).json({
          message: "Invalid language format. Use language code (e.g., en-US).",
        });
      }
    }

    // Update user profile
    updateData.updatedBy = userId; // Track who updated the profile
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
      select:
        "-password -twoFactorSecret -resetPasswordToken -resetPasswordExpires",
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res
      .status(200)
      .json({ message: "Profile updated successfully.", user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.softDeleteAccount = async (req, res) => {
  try {
    const userId = req.user.id; // Retrieved from JWT token

    // Find the user and check if they exist
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent already deleted users from being deleted again
    if (user.deleted) {
      return res.status(400).json({ message: "Account is already deleted." });
    }

    // Soft delete the account by updating the 'deleted' flag and setting a deletion timestamp
    user.deleted = true;
    user.deletionScheduledAt = new Date();

    await user.save();

    res.status(200).json({ message: "Account deleted successfully." });
  } catch (error) {
    console.error("Error soft deleting account:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


exports.getTenants = async (req, res) => {
  console.log("🔍 getTenants route hit");

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized request." });
    }

    console.log("🔍 Fetching user:", userId);
    const user = await User.findById(userId);

    if (!user) {
      console.warn("❌ User not found");
      return res.status(404).json({ message: "User not found." });
    }

    if (!Array.isArray(user.tenantIds) || user.tenantIds.length === 0) {
      console.info("ℹ️ User is not associated with any tenants.");
      return res.status(200).json({ tenants: [] });
    }

    console.log("🔍 Fetching tenant details via API Gateway:", user.tenantIds);

    try {
      const response = await axios.post(
        `${process.env.API_GATEWAY_URL}/tenants/bulk`,
        { tenantIds: user.tenantIds },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      const tenantDetails = response.data?.data || response.data?.tenants || [];

      console.log(`✅ Retrieved ${tenantDetails.length} tenants`);
      return res.status(200).json({ tenants: tenantDetails });
    } catch (fetchError) {
      console.error("❌ Error fetching tenants from API Gateway:", {
        message: fetchError.message,
        response: fetchError.response?.data,
      });

      return res
        .status(fetchError.response?.status || 502)
        .json({ message: "Failed to fetch tenant details." });
    }
  } catch (error) {
    console.error("❌ Unexpected error in getTenants:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.associateTenant = async (req, res) => {
  console.log("🔍 associateTenant route hit");

  try {
    const userId = req.user.id;
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if already associated
    if (user.tenantIds.some((id) => id.toString() === tenantId)) {
      return res
        .status(409)
        .json({ message: "User is already associated with this tenant." });
    }

    // ✅ Check that tenant exists using gateway
    try {
      const response = await axios.get(
        `${process.env.API_GATEWAY_URL}/tenants/${tenantId}`,
        { headers: { Authorization: req.headers.authorization } }
      );

      if (!response.data?.data) {
        return res.status(404).json({ message: "Tenant not found." });
      }
    } catch (error) {
      console.error(
        "❌ Error validating tenant:",
        error.response?.data || error.message
      );
      return res.status(502).json({ message: "Error validating tenant." });
    }

    // 🔐 Save association
    user.tenantIds.push(tenantId);
    await user.save();

    console.log("✅ Tenant associated successfully:", tenantId);
    res.status(200).json({
      message: "Tenant associated successfully.",
      tenantIds: user.tenantIds,
    });
  } catch (error) {
    console.error("❌ Internal server error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.removeTenantAssociation = async (req, res) => {
  console.log("🔍 removeTenantAssociation route hit");

  try {
    const userId = req.user.id;
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if tenant is associated
    const isAssociated = user.tenantIds.some(
      (id) => id.toString() === tenantId
    );
    if (!isAssociated) {
      return res
        .status(400)
        .json({ message: "User is not associated with this tenant." });
    }

    // Remove tenant ID from user's list
    user.tenantIds = user.tenantIds.filter((id) => id.toString() !== tenantId);
    await user.save();

    console.log("✅ Tenant removed successfully:", tenantId);
    res.status(200).json({
      message: "Tenant removed successfully.",
      tenantIds: user.tenantIds,
    });
  } catch (error) {
    console.error("❌ Internal server error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.getPreferences = async (req, res) => {
  console.log("🔍 getPreferences route hit");

  try {
    const userId = req.user.id;
    console.log("🔍 Fetching preferences for user:", userId);

    // Find the user by ID and select only the preferences field
    const user = await User.findById(userId).select("preferences");

    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ message: "User not found." });
    }

    console.log("✅ User preferences retrieved:", user.preferences);
    res.status(200).json({ preferences: user.preferences });
  } catch (error) {
    console.log("❌ Internal server error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id; // Get the user ID from the token
    const { theme, language } = req.body; // Get preferences from the request body

    // Validate input (optional but good practice)
    const validThemes = ["light", "dark", "system"];
    if (theme && !validThemes.includes(theme)) {
      return res.status(400).json({ message: "Invalid theme selected." });
    }

    if (language && typeof language !== "string") {
      return res.status(400).json({ message: "Invalid language format." });
    }

    // Find and update user preferences
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { "preferences.theme": theme, "preferences.language": language },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      message: "Preferences updated successfully.",
      preferences: updatedUser.preferences,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Retrieve user with notifications field
    const user = await User.findById(userId).select("notifications");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Ensure notifications object always exists (Fix)
    const notifications = user.notifications;

    res.status(200).json({ notifications });
  } catch (error) {
    console.error("🔥 Error fetching notifications:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


exports.updateNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    let { email, sms, push } = req.body;

    // Coerce string booleans to real booleans (e.g., from JSON or form data)
    email = email === true || email === "true";
    sms = sms === true || sms === "true";
    push = push === true || push === "true";

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        "notifications.email": email,
        "notifications.sms": sms,
        "notifications.push": push,
      },
      { new: true, runValidators: true, select: "notifications" }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      message: "Notification preferences updated successfully.",
      notifications: updatedUser.notifications,
    });
  } catch (error) {
    console.error("❌ Error updating notifications:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
