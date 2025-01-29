const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validateToken } = require("../middleware/userValidation");;
const {
  validateRegister,
  validateLogin,
  validate,
} = require("../middleware/validation");

router.post("/register", validateRegister, validate, authController.register);
router.post("/login", validateLogin, validate, authController.login);
router.post("/logout", authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.post("/verify-email", authController.verifyEmail);
router.post(
  "/resend-verification-email",
  authController.resendVerificationEmail
);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/change-password", validateToken, authController.changePassword);
router.post("/account-recovery", authController.accountRecovery);
router.post("/enable-2fa", authController.enable2FA);
router.post("/verify-2fa", authController.verify2FA);
router.post("/disable-2fa", authController.disable2FA);
router.post("/social-login", authController.socialLogin);
module.exports = router;
