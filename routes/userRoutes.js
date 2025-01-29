const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authMiddleware } = require("../middleware/userValidation");

// Protect all routes with `authMiddleware`
router.get("/me", authMiddleware, userController.getProfile);
//router.put("/me", authMiddleware, userController.updateProfile);
//router.delete("/me", authMiddleware, userController.softDeleteAccount);
//router.get("/me/tenants", authMiddleware, userController.getTenants);
//router.post("/me/tenants", authMiddleware, userController.associateTenant);
//router.delete(
//  "/me/tenants/:tenantId",
//  authMiddleware,
//  userController.removeTenantAssociation
//);
//router.get("/me/preferences", authMiddleware, userController.getPreferences);
//router.put("/me/preferences", authMiddleware, userController.updatePreferences);
//router.put(
//  "/me/notifications",
//  authMiddleware,
//  userController.updateNotifications
//);
//router.get(
//  "/me/security-settings",
//  authMiddleware,
//  userController.getSecuritySettings
//);

module.exports = router;
