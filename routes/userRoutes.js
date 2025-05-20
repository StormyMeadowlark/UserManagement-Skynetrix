const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const groupController = require("../controllers/groupController");
const { authMiddleware } = require("../middleware/userValidation");


// Create a new user group
router.post("/groups", authMiddleware, groupController.createUserGroup);
router.get("/groups/me", authMiddleware, groupController.getMyGroups);
router.get("/groups/archived", authMiddleware, groupController.getArchivedGroups);
router.get("/search", authMiddleware, groupController.searchGroups);
router.patch("/groups/:groupId/archive", authMiddleware, groupController.archiveGroup);
router.patch("/groups/:groupId/unarchive", authMiddleware, groupController.unarchiveGroup);
router.patch("/groups/:groupId/join", authMiddleware, groupController.joinGroupWithAccessCode);
router.patch("/groups/:groupId/leave", authMiddleware, groupController.leaveGroup);
router.patch("/groups/:groupId/transfer", authMiddleware, groupController.transferGroupOwnership);
router.get("/groups/:groupId", authMiddleware, groupController.getMyGroups);
router.patch("/groups/:groupId", authMiddleware, groupController.updateGroupByOwner);
router.delete("/groups/:groupId", authMiddleware, groupController.deleteGroup);





// Protect all routes with `authMiddleware`
router.get("/me", authMiddleware, userController.getProfile);
router.put("/me", authMiddleware, userController.updateProfile);
router.delete("/me", authMiddleware, userController.softDeleteAccount);
router.get("/me/tenants", authMiddleware, userController.getTenants);
router.post("/me/tenants", authMiddleware, userController.associateTenant);
router.delete(
  "/me/tenants/:tenantId",
  authMiddleware,
  userController.removeTenantAssociation
);
router.get("/me/preferences", authMiddleware, userController.getPreferences);
router.put("/me/preferences", authMiddleware, userController.updatePreferences);
router.get("/me/notifications", authMiddleware, userController.getNotifications);
router.put(
  "/me/notifications",
  authMiddleware,
  userController.updateNotifications
);


router.get("/me/shops", authMiddleware, userController.getAssociateShops)
router.get("/me/shops/favorites", authMiddleware, userController.getFavoriteAssociateShops);
router.put("/me/shops/:shopId", authMiddleware, userController.createAssociateShop);
router.put("/me/shops/:shopId/remove", authMiddleware, userController.removeShopAssociation);
router.get("/me/shops/:shopId", authMiddleware, userController.getAssociateShopDetails);
router.put("/me/shops/:shopId/add-favorite", authMiddleware, userController.favoriteAssociateShop);
router.put("/me/shops/:shopId/remove-favorite", authMiddleware, userController.removeFavoriteAssociateShop);


//router.get(
//  "/me/security-settings",
//  authMiddleware,
//  userController.getSecuritySettings
//);

module.exports = router;
