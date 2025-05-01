const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const {
  authMiddleware,
  adminMiddleware,
} = require("../middleware/userValidation");
const validateApiKey = require("../middleware/apiKeyMiddleware")

router.patch(
  "/users/:id/status",
  validateApiKey,
  adminController.updateUserStatus
);

// 🏷️ Get a list of all users (Admin Only)

router.get(
  "/users",
  authMiddleware,
  adminMiddleware,
  adminController.getAllUsers
);

// 🏷️ Search users by criteria like name, email, or role
router.get(
  "/users/search",
  authMiddleware,
  adminMiddleware,
  adminController.searchUsers
);
router.get("/users/internal-search", validateApiKey, adminController.searchUsersInternal);
// 🏷️ Get details of a specific user
router.get(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  adminController.getUserById
);

// 🏷️ Update a user's profile
router.put(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  adminController.updateUserProfile
);

// 🏷️ Permanently delete a user
router.delete(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  adminController.deleteUser
);
// 🏷️ Fetch roles for a user, scoped by tenant or globally
router.get(
  "/users/:id/roles",
  authMiddleware,
  adminMiddleware,
  adminController.getUserRoles
);

// 🏷️ Assign or update roles for a user
router.put(
  "/users/:id/roles",
  authMiddleware,
  adminMiddleware,
  adminController.updateUserRoles
);



/*
// 🏷️ Tracks changes for auditing or debugging purposes
router.get(
  "/users/:id/audit-logs",
  authMiddleware,
  adminMiddleware,
  adminController.getAuditLogs
);

// 🏷️ Admin view of a user's login history
router.get(
  "/users/:id/login-history",
  authMiddleware,
  adminMiddleware,
  adminController.getUserLoginHistory
);

// 🏷️ Fetch aggregate data on users (e.g., active users)
router.get(
  "/users/analytics",
  authMiddleware,
  adminMiddleware,
  adminController.getUserAnalytics
);
*/
module.exports = router;
