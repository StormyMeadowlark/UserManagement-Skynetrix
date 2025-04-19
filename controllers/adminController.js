const User = require("../models/userModel");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const getAccessibleTenantIds = require("../utils/getAccessibleTenantIds");
const buildUserSearchFilter = require("../utils/buildUserSearchFilter");

// ✅ Get a list of all users (Admin Only)
exports.getAllUsers = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Missing token." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = {
      id: decoded.id,
      email: decoded.email,
      userRole: decoded.userRole,
      tenantId: decoded.tenantId,
      tenantType: decoded.tenantType,
      token, // ✅ add the raw token to pass through
    };

    const accessibleTenantIds = await getAccessibleTenantIds(user);

    if (!accessibleTenantIds.length) {
      return res.status(403).json({
        message: "Access denied. You are not authorized to view users.",
      });
    }

    const users = await User.find(
      { tenantIds: { $in: accessibleTenantIds }, deleted: false },
      "-password"
    );

    if (!users.length) {
      return res.status(404).json({ message: "No users found in your scope." });
    }

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully.",
      users,
    });
  } catch (error) {
    console.error("❌ Error fetching scoped users:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Search Users (Admin Only)
exports.searchUsers = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Missing token." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = {
      id: decoded.id,
      email: decoded.email,
      userRole: decoded.userRole,
      tenantId: decoded.tenantId,
      tenantType: decoded.tenantType,
      token,
    };

    const accessibleTenantIds = await getAccessibleTenantIds(user);
    if (!accessibleTenantIds.length) {
      return res.status(403).json({ message: "Access denied." });
    }

    const searchFilter = buildUserSearchFilter(req.query);

    searchFilter.tenantIds = { $in: accessibleTenantIds };

    const users = await User.find(searchFilter, "-password");

    if (!users.length) {
      return res.status(404).json({ message: "No users found." });
    }

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully.",
      users,
    });
  } catch (error) {
    console.error("❌ Error in searchUsers:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Get User by ID (Admin Only)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 Reconstruct user context from JWT
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Missing token." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = {
      id: decoded.id,
      email: decoded.email,
      userRole: decoded.userRole,
      tenantId: decoded.tenantId,
      tenantType: decoded.tenantType,
      token,
    };

    // 🔍 Lookup user
    const targetUser = await User.findById(id, "-password");

    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // 🛡️ Enforce tenant scope
    const accessibleTenantIds = await getAccessibleTenantIds(currentUser);

    const hasTenantAccess = targetUser.tenantIds.some((tid) =>
      accessibleTenantIds.includes(tid.toString())
    );

    if (!hasTenantAccess) {
      return res.status(403).json({ message: "Access denied." });
    }

    // ✅ User is accessible
    return res.status(200).json({
      success: true,
      message: "User retrieved successfully.",
      user: targetUser,
    });
  } catch (error) {
    console.error("❌ Error fetching user by ID:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    return res.status(500).json({ message: "Internal server error." });
  }
};


// ✅ Update User Profile (Admin Only)
exports.updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 Reconstruct user context from JWT
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Missing token." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = {
      id: decoded.id,
      email: decoded.email,
      userRole: decoded.userRole,
      tenantId: decoded.tenantId,
      tenantType: decoded.tenantType,
      token,
    };

    // 🔍 Lookup target user
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // 🔒 Enforce tenant access scope
    const accessibleTenantIds = await getAccessibleTenantIds(currentUser);
    const hasAccess = targetUser.tenantIds.some((tid) =>
      accessibleTenantIds.includes(tid.toString())
    );

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied." });
    }

    // ✅ Define allowed fields for update
    const allowedFields = [
      "email",
      "phone",
      "secondaryPhone",
      "name",
      "birthday",
      "address",
      "role",
      "generalRole",
      "twoFactorEnabled",
      "twoFactorMethods",
      "marketing",
      "notifications",
      "preferences",
      "userPreferences",
      "status",
    ];

    // ✏️ Filter only allowed updates
    const updateFields = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updateFields[key] = req.body[key];
      }
    }

    updateFields.updatedBy = currentUser.id;

    // 🔄 Apply updates
    const updatedUser = await User.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
      select: "-password",
    });

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user profile:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
};


// ✅ Delete User (Admin Only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 Reconstruct user context from JWT
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Missing token." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = {
      id: decoded.id,
      email: decoded.email,
      userRole: decoded.userRole,
      tenantId: decoded.tenantId,
      tenantType: decoded.tenantType,
    };

    // 🔒 Only Platform Admin + tenantAdmin role can delete users
    if (
      currentUser.tenantType !== "Platform Admin" ||
      currentUser.userRole !== "tenantAdmin"
    ) {
      return res
        .status(403)
        .json({
          message: "Access denied. You are not authorized to delete users.",
        });
    }

    // 🔍 Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 💣 Delete the user
    await User.findByIdAndDelete(id);

    return res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("❌ Error deleting user:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    return res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Get user roles, scoped by tenant or globally
exports.getUserRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId: queryTenantId } = req.query;

    const requestingUser = req.user;

    // 🔍 Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    const targetUser = await User.findById(id).select("role tenantIds");

    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // 🔐 PLATFORM ADMIN + tenantAdmin can always view
    if (
      requestingUser.tenantType === "Platform Admin" &&
      requestingUser.userRole === "tenantAdmin"
    ) {
      return res.status(200).json({
        message: "User roles retrieved successfully.",
        roles: [targetUser.role],
        tenantIds: targetUser.tenantIds,
      });
    }

    // 🔐 All others — get accessible tenants
    const allowedTenantIds = await getAccessibleTenantIds(requestingUser);

    const isAuthorized = targetUser.tenantIds.some((tid) =>
      allowedTenantIds.includes(tid.toString())
    );

    if (!isAuthorized) {
      return res.status(403).json({
        message: "You are not authorized to view this user's role.",
      });
    }

    return res.status(200).json({
      message: "User roles retrieved successfully.",
      roles: [targetUser.role],
      tenantIds: targetUser.tenantIds,
    });
  } catch (error) {
    console.error("❌ Error fetching user roles:", error.message, error.stack);
    return res.status(500).json({ message: "Internal server error." });
  }
};



// ✅ Update user roles (Admin Only)
exports.updateUserRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const requestingUser = req.user;

    // 🔍 Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    // 🔍 Validate role
    const validRoles = ["user", "admin", "tenantAdmin"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Allowed roles: ${validRoles.join(", ")}.`,
      });
    }

    const targetUser = await User.findById(id).select("tenantIds role");

    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // 🔓 Full access for Platform Admin + tenantAdmin
    const isSuperAdmin =
      requestingUser.tenantType === "Platform Admin" &&
      requestingUser.userRole === "tenantAdmin";

    if (!isSuperAdmin) {
      const allowedTenantIds = await getAccessibleTenantIds(requestingUser);

      const isAllowed = targetUser.tenantIds.some((tid) =>
        allowedTenantIds.includes(tid.toString())
      );

      if (!isAllowed) {
        return res.status(403).json({
          message: "You are not authorized to update this user's role.",
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { role, updatedBy: requestingUser.id },
      { new: true, runValidators: true }
    ).select("role name email");

    return res.status(200).json({
      message: "User role updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user roles:", error.message, error.stack);
    return res.status(500).json({ message: "Internal server error." });
  }
};
