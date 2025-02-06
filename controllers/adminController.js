const User = require("../models/userModel");
const mongoose = require("mongoose");

// ✅ Get a list of all users (Admin Only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password"); // Exclude passwords

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found." }); // 🔥 Keep 404 for clarity
    }

    res.status(200).json({
      message: "Users retrieved successfully.",
      users,
    });
  } catch (error) {
    console.error("❌ Error fetching all users:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Search Users (Admin Only)
exports.searchUsers = async (req, res) => {
  try {
    const searchQuery = req.query; // Get search filters from request query
    const filter = {};

    // Iterate over request query parameters to build dynamic filters
    Object.keys(searchQuery).forEach((key) => {
      if (searchQuery[key]) {
        // Convert to case-insensitive regex for partial matches (except ObjectIds and booleans)
        if (
          [
            "email",
            "phone",
            "secondaryPhone",
            "name",
            "status",
            "role",
            "preferences.language",
          ].includes(key)
        ) {
          filter[key] = { $regex: new RegExp(searchQuery[key], "i") };
        }
        // Handle nested fields like address, verification, etc.
        else if (key.startsWith("address.")) {
          filter[key] = { $regex: new RegExp(searchQuery[key], "i") };
        }
        // Convert boolean values
        else if (["twoFactorEnabled", "deleted"].includes(key)) {
          filter[key] = searchQuery[key] === "true";
        }
        // Convert ObjectIds for tenants and vehicles
        else if (
          ["tenantIds", "vehicles", "createdBy", "updatedBy"].includes(key)
        ) {
          filter[key] = searchQuery[key]; // Expecting exact match for IDs
        }
        // Convert date fields to proper format
        else if (
          [
            "birthday",
            "lastActivityAt",
            "deletionScheduledAt",
            "createdAt",
            "updatedAt",
          ].includes(key)
        ) {
          filter[key] = new Date(searchQuery[key]);
        }
      }
    });

    // Search the database
    const users = await User.find(filter, "-password"); // Exclude passwords for security

    if (users.length === 0) {
      return res.status(404).json({ message: "No matching users found." });
    }

    res.status(200).json({ users });
  } catch (error) {
    console.error("❌ Error searching users:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Get User by ID (Admin Only)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params; // Extract user ID from URL

    // Find user by ID, excluding password for security
    const user = await User.findById(id, "-password");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("❌ Error fetching user by ID:", error);

    // Handle invalid ObjectId format errors
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    res.status(500).json({ message: "Internal server error." });
  }
};


// ✅ Update User Profile (Admin Only)
exports.updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params; // Extract user ID from URL
    const updateFields = { ...req.body }; // Get update data

    // Fields that cannot be updated by an admin
    const restrictedFields = [
      "password",
      "twoFactorSecret",
      "resetPasswordToken",
      "resetPasswordExpires",
      "deleted",
    ];

    // Remove restricted fields from the update object
    restrictedFields.forEach((field) => delete updateFields[field]);

    // Find and update the user, while excluding restricted fields
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { ...updateFields, updatedBy: req.user.id }, // Track the admin who updated it
      { new: true, runValidators: true, select: "-password" } // Return the updated user without the password
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      message: "User profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user profile:", error);

    // Handle invalid ObjectId format errors
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    res.status(500).json({ message: "Internal server error." });
  }
};


// ✅ Delete User (Admin Only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params; // Extract user ID from URL

    // Check if the user exists before deleting
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("❌ Error deleting user:", error);

    // Handle invalid ObjectId format errors
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Get user roles, scoped by tenant or globally
exports.getUserRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query; // Optional tenant scope

    // 🔍 Validate the user ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error("❌ Invalid user ID format:", id);
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    console.log(`Fetching roles for user ID: ${id}`);
    const user = await User.findById(id).select("role tenantIds");

    // 🔍 Handle user not found
    if (!user) {
      console.error("❌ User not found:", id);
      return res.status(404).json({ message: "User not found." });
    }

    // 🔍 Check if a tenant scope is provided
    if (tenantId) {
      console.log(`Checking user tenant association: ${tenantId}`);
      const tenantExists = user.tenantIds.some(
        (tenant) => tenant.toString() === tenantId
      );

      if (!tenantExists) {
        console.error(`❌ User does not belong to tenant ${tenantId}`);
        return res
          .status(403)
          .json({ message: "User does not belong to this tenant." });
      }

      return res.status(200).json({
        message: "User roles retrieved successfully for tenant.",
        roles: [user.role], // Assuming one role per user
        tenantId,
      });
    }

    // ✅ Return the user's global role
    res.status(200).json({
      message: "User roles retrieved successfully.",
      roles: [user.role],
    });
  } catch (error) {
    console.error("❌ Error fetching user roles:", error.message, error.stack);
    res.status(500).json({ message: "Internal server error." });
  }
};



// ✅ Update user roles (Admin Only)
exports.updateUserRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // 🔍 Validate the user ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error("❌ Invalid user ID format:", id);
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    // 🔍 Validate role
    const validRoles = ["user", "admin", "tenantAdmin"];
    if (!role || !validRoles.includes(role)) {
      console.error("❌ Invalid role:", role);
      return res.status(400).json({
        message: `Invalid role. Allowed roles: ${validRoles.join(", ")}.`,
      });
    }

    console.log(`Updating role for user ID: ${id} to ${role}`);
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select("role name email");

    // 🔍 Handle user not found
    if (!updatedUser) {
      console.error("❌ User not found:", id);
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      message: "User role updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user roles:", error.message, error.stack);
    res.status(500).json({ message: "Internal server error." });
  }
};
