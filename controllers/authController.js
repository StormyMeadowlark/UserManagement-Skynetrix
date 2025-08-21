const User = require("../models/userModel");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../utils/email");
const { loadTemplate } = require("../utils/templateLoader");
const mongoose = require("mongoose");
const { usageQueue, addJob } = require("../utils/bullmq");
const TenantRoleMap = require("../config/tenantRoleMap"); // or wherever you keep it

 // or wherever you keep it


const SHOPWARE_BASE_URL = process.env.SHOPWARE_API_URL || "";
const SHOPWARE_X_API_PARTNER_ID = process.env.SHOPWARE_X_API_PARTNER_ID;
const SHOPWARE_X_API_SECRET = process.env.SHOPWARE_X_API_SECRET;
const TENANT_SERVICE_URL =
  process.env.TENANT_SERVICE_URL || "https://localhost:8312/api/v2/tenants";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

exports.register = async (req, res) => {


  console.log("🔹 Incoming registration request:", req.body);

  let tenantId, tenantType, tier, shopwareSettings;


  try {
    let {
      email,
      password,
      firstName,
      lastName,
      phone,
      birthday,
      marketing,
      businessName,
      role,
      address,
      city,
      state,
      zip,
      generalRole,
      technicianProfile,
      wantsAccount,
      sendInvite
    } = req.body;

    if (generalRole !== "Technician") {
      technicianProfile = undefined;
    }
    if (!phone) {
      console.log("❌ Missing required fields:", { phone });
      return res
        .status(400)
        .json({ message: "phone number is required." });
    }

    // Extract tenant domain
    const domain =
      req.headers["x-tenant-domain"] ||
      req.headers.origin?.replace(/^https?:\/\//, "").split("/")[0];

    if (!domain) {
      return res.status(400).json({ message: "Domain is missing." });
    }
    console.log("👀 Tenant type:", tenantType);
    console.log("✅ Extracted domain:", domain);

    // 🔹 Fetch tenant details
    const tenantResponse = await axios.get(
      `${TENANT_SERVICE_URL}/domain/${domain}`
    );

    console.log("🌐 Tenant service response:", tenantResponse.data);

    if (tenantResponse.data?.success && tenantResponse.data?.data?.tenantId) {
      const tenantData = tenantResponse.data.data;
      tenantId = tenantData.tenantId;
      tier = tenantData.tier || "Basic";
      tenantType = tenantData.type || "Shop"; // fallback default
      shopwareSettings = tenantData.shopware;
    } else {
      console.warn(
        "❌ Unexpected tenant response structure or tenant not found"
      );
      return res.status(404).json({ message: "Tenant not found." });
    }

    // 🔹 Normalize and validate phone
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res
        .status(400)
        .json({ message: "Invalid phone number format. Must be 10 digits." });
    }

    let isProvisioned = !wantsAccount && !sendInvite && (!email || email.trim() === "");
    if (wantsAccount === "true" || sendInvite === "true") {
      isProvisioned = false;
    } else {
      isProvisioned = true;
    }


    // 🔹 Check for existing user
const existingUser = await User.findOne({
  isProvisioned: true,
  $and: [
    { firstName: firstName },
    { lastName: lastName },
    { phone: phone || null },
  ],
});

    if (existingUser) {
      console.log("⚠️ Provisional user match found, initiating claim flow.");

      return res.status(202).json({
        message:
          "Provisional account found. VIN verification required to claim.",
        matchType: {
          phone: existingUser.phone === phone,
          name: existingUser.name?.toLowerCase() === name?.toLowerCase(),
        },
        provisionalUserId: existingUser._id,
        requireVINVerification: true,
      });
    }
    
    if (email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "Email already exists." });
      }
    }
    
    let createdBy = null;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      const token = req.headers.authorization.split(" ")[1];

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        createdBy = decoded.id || null;
      } catch (err) {
        console.warn("⚠️ Failed to decode token for createdBy:", err.message);
      }
    }
    if (!TenantRoleMap[tenantType]?.includes(generalRole)) {
      return res.status(400).json({
        message: `Invalid general role '${generalRole}' for tenant type '${tenantType}'.`,
      });
    }
    
    // 🔹 Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role,
      generalRole,
      phone: normalizedPhone,
      birthday,
      marketing,
      tenantIds: [
        mongoose.Types.ObjectId.isValid(tenantId)
          ? new mongoose.Types.ObjectId(tenantId)
          : null,
      ].filter(Boolean),
      verification: {
        isEmailVerified: false,
        verifyEmailToken: crypto.randomBytes(32).toString("hex"),
        verifyEmailExpires: Date.now() + 24 * 60 * 60 * 1000,
      },
      isProvisioned,
      createdBy,
      ...(generalRole === "Technician" && technicianProfile
        ? { technicianProfile }
        : {}), // Set the creator's ID if available
    });
     await user.save();
    console.log("✅ User created:", user._id);
    console.log("User email:", user.email)

    // 🔹 Sync to Shopware (if applicable)
    let shopwareCustomerId = null;
    if (shopwareSettings?.enabled && shopwareSettings.tenantId) {
      try {
        const searchResponse = await axios.get(
          `${SHOPWARE_BASE_URL}/api/v1/tenants/${shopwareSettings.tenantId}/customers?phone_number=${normalizedPhone}`,
          {
            headers: {
              "X-Api-Partner-Id": SHOPWARE_X_API_PARTNER_ID,
              "X-Api-Secret": SHOPWARE_X_API_SECRET,
            },
          }
        );

        if (searchResponse.data?.data?.length) {
          shopwareCustomerId = searchResponse.data.data[0].id;
        } else {
          const customerZip = shopwareSettings.importAddress ? zip : "00000"; // fallback if needed
          const createResponse = await axios.post(
            `${SHOPWARE_BASE_URL}/api/v1/tenants/${shopwareSettings.tenantId}/customers`,
            {
              first_name: firstName,
              last_name: lastName,
              email,
              phone: normalizedPhone,
              marketing_ok: marketing || false,
              date_of_birth: birthday || null,
              customer_type: businessName ? "corporate" : "individual",
              business_name: businessName || null,
              address: shopwareSettings.importAddress ? address : undefined,
              city: shopwareSettings.importAddress ? city : undefined,
              state: shopwareSettings.importAddress ? state : undefined,
              zip: customerZip,
            },
            {
              headers: {
                "X-Api-Partner-Id": SHOPWARE_X_API_PARTNER_ID,
                "X-Api-Secret": SHOPWARE_X_API_SECRET,
                "Content-Type": "application/json",
              },
            }
          );

          if (createResponse.status === 201 && createResponse.data?.id) {
            shopwareCustomerId = createResponse.data.id;
          }
        }
      } catch (error) {
        console.error(
          "❌ Shopware sync failed:",
          error.response?.data || error.message
        );
        return res.status(500).json({ message: "Shopware API failure." });
      }
    }

    // 🔹 Save Shopware ID (if applicable)
    if (shopwareCustomerId) {
      user.shopwareUserId = shopwareCustomerId;
      await user.save();
    }

    // 🔹 Send verification email
    if (email && (wantsAccount || sendInvite)) {
      const template = loadTemplate("verify-email");
      const tenantDomain = req.headers.domain|| "https://skynetrix.tech";
      const emailBody = template
        .replace("{{name}}", user.name)
        .replace(
          "{{verifyEmailLink}}",
          `${tenantDomain}/verify-email?token=${user.verification.verifyEmailToken}`
        );

      await sendEmail(user.email, "Verify Your Email", emailBody);
      console.log(`📩 Verification email sent to ${user.email}`);
    } else {
      console.log(
        "📭 No verification email sent (account not requested or no email provided)."
      );
    }
    // 🔹 Track usage
    try {
      await addJob(usageQueue, {
        tenantId,
        tenantType,
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        tier,
        microservice: "user-management",
        action: "USER_CREATED",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Failed to add usage event job:", error);
    }

    // 🔹 Success response
    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      userId: user._id,
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res
      .status(500)
      .json({ message: "Internal server error during registration." });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.verification?.isEmailVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email before logging in." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const primaryTenantId = user.tenantIds?.[0];
    if (!primaryTenantId) {
      return res
        .status(400)
        .json({ message: "User is not associated with a tenant." });
    }

    // ⬇️ Make an unauthenticated call to get tenant info
    const tenantServiceURL =
      process.env.TENANT_SERVICE_URL || "http://localhost:2024/api/v2/tenants";

    const tenantResponse = await axios.get(
      `${tenantServiceURL}/${primaryTenantId}/public`
    );
    const tenant = tenantResponse.data?.data;
    user.lastLoginAt = new Date();
    user.lastActivityAt = new Date(); // Optional but smart to track
    user.tokenVersion += 1;

    user.loginHistory.push({
      ipAddress: req.ip,
      timestamp: new Date(),
      device: req.headers["user-agent"] || "Unknown",
    });
    
    await user.save();
    if (!tenant) {
      return res.status(404).json({ message: "Associated tenant not found." });
    }
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        userRole: user.role, // 👈 From User (e.g., "tenantAdmin")
        generalRole: user.generalRole, // 👈 From User (e.g., "customer")
        roles: [user.roles],
        shop: user.shopProfiles.shopProfileId,
        tenantId: primaryTenantId, // 👈 ID of the tenant they belong to
        tenantType: tenant.type, // 👈 From Tenant (e.g., "Platform Admin")
        tier: tenant.tier,
        tokenVersion: user.tokenVersion, // 👈 From Tenant (e.g., "Premium")
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: error });
  }
};

// Log out the user
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Missing token." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.tokenVersion += 1;
    await user.save();

    res.status(200).json({ message: "Logout successful." });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Logout failed due to server error." });
  }
};



// Refresh the JWT
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.body.token;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required." });
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Fetch the user associated with the token
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token." });
    }

    // 🔐 Check token version
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: "Token is no longer valid." });
    }

    // Check if the user's email is verified
    if (!user.verification?.isEmailVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email to use this feature." });
    }

    // 🧠 Determine primary tenant
    const primaryTenantId = user.tenantIds?.[0] || null;

    // You may need to fetch tenant info from your tenant service if you don't store tenantType and tier on the user directly
    let tenantType = "Shop";
    let tenantTier = "Basic";

    if (primaryTenantId) {
      try {
        const tenantRes = await axios.get(
          `${TENANT_SERVICE_URL}/id/${primaryTenantId}`
        );
        if (tenantRes.data?.success && tenantRes.data?.data) {
          tenantType = tenantRes.data.data.type || "Shop";
          tenantTier = tenantRes.data.data.tier || "Basic";
        }
      } catch (err) {
        console.warn("⚠️ Could not fetch tenant data for token:", err.message);
      }
    }

    // 🎟️ Issue new token
    const newToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        userRole: user.role,
        generalRole: user.generalRole,
        roles: user.roles,
        tenantId: primaryTenantId,
        tenantType,
        tenantTier,
        tokenVersion: user.tokenVersion, // Include in all JWTs
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    res.status(200).json({
      message: "Token refreshed successfully.",
      token: newToken,
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(401).json({ message: "Invalid or expired refresh token." });
  }
};


// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ message: "Verification token is required." });
    }

    const user = await User.findOne({
      "verification.verifyEmailToken": token,
      "verification.verifyEmailExpires": { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    user.verification.isEmailVerified = true;
    user.verification.verifyEmailToken = null;
    user.verification.verifyEmailExpires = null;

    await user.save();

    res.status(200).json({ message: "Email verified successfully." });
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Resend verification email
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Check if the email is in a valid format (optional)
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.verification?.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    // Generate a new verification token
    const verifyEmailToken = crypto.randomBytes(32).toString("hex");
    user.verification.verifyEmailToken = verifyEmailToken;
    user.verification.verifyEmailExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await user.save();

    // Load and send the verification email
    const template = loadTemplate("verify-email");
    const emailBody = template
      .replace("{{name}}", user.name)
      .replace(
        "{{verifyEmailLink}}",
        `${process.env.FRONTEND_URL}/verify-email?token=${verifyEmailToken}`
      );

    await sendEmail(user.email, "Verify Your Email", emailBody);

    res.status(200).json({ message: "Verification email sent successfully." });
  } catch (error) {
    console.error("Error resending verification email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const resetPasswordToken = crypto.randomBytes(32).toString("hex");
    const resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpires = resetPasswordExpires;

    await user.save();

    // Load and send password reset email
    const template = loadTemplate("reset-password");
    const emailBody = template
      .replace("{{name}}", user.name)
      .replace(
        "{{resetPasswordLink}}",
        `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`
      );

    await sendEmail(user.email, "Reset Your Password", emailBody);

    res
      .status(200)
      .json({ message: "Password reset email sent successfully." });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required." });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    // 🔐 Invalidate all current tokens
    user.tokenVersion += 1;

    await user.save();

    res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Error in reset password:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Both old and new passwords are required." });
    }

    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect." });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters long." });
    }

    user.password = newPassword;

    // 🔐 Invalidate all current JWTs
    user.tokenVersion += 1;

    await user.save();

    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Error in change password:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// Account Recovery
exports.accountRecovery = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const { deleted, status } = user;

    const shouldAutoApprove =
      (deleted && status === "Inactive") ||
      (deleted && status === "Active") ||
      (!deleted && status === "Inactive");

    if (shouldAutoApprove) {
      const recoveryToken = crypto.randomBytes(32).toString("hex");

      user.verification.verifyEmailToken = recoveryToken;
      user.verification.verifyEmailExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      await user.save();

      const template = loadTemplate("account-recovery");
      const recoveryLink = `${process.env.FRONTEND_URL}/account-recovery?token=${recoveryToken}`;

      const emailBody = template
        .replace("{{name}}", user.name)
        .replace("{{recoveryLink}}", recoveryLink);

      await sendEmail(user.email, "Recover Your Account", emailBody);

      return res
        .status(200)
        .json({ message: "Account recovery email sent successfully." });
    }

    return res.status(403).json({
      message:
        "Your account requires manual review for recovery. Please contact support.",
    });
  } catch (error) {
    console.error("Error in account recovery:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.verifyAccountRecovery = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Missing recovery token." });
    }

    const user = await User.findOne({
      "verification.verifyEmailToken": token,
      "verification.verifyEmailExpires": { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // ✅ Reactivate account
    user.deleted = false;
    user.status = "Active";

    // 🔐 Invalidate all old tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    // 🧹 Clear recovery tokens
    user.verification.verifyEmailToken = null;
    user.verification.verifyEmailExpires = null;

    await user.save();

    // 📓 Optionally log recovery
    // await addAuditLog({
    //   userId: user._id,
    //   action: "ACCOUNT_RECOVERY",
    //   metadata: { method: "self-service" },
    // });

    return res.status(200).json({ message: "Account successfully recovered." });
  } catch (error) {
    console.error("Error verifying account recovery:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};


exports.verifyVin = async (req, res) => {
  try {
    const { provisionalUserId, vin } = req.body;

    if (!provisionalUserId || !vin) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const user = await User.findById(provisionalUserId);

    if (!user || !user.isProvisioned) {
      return res.status(404).json({ message: "Provisional user not found." });
    }

    // 🔍 Fetch VINs from Vehicle service
    const vehicleResponse = await axios.get(
      `${process.env.VEHICLE_SERVICE_URL}/vehicles/by-user/${provisionalUserId}/vins`,
      {
        headers: { "x-api-key": process.env.INTERNAL_API_KEY },
      }
    );

    const validVINs = vehicleResponse.data?.vins || [];
    const submittedVIN = vin.trim().toUpperCase();
    const vinMatch = validVINs.includes(submittedVIN);

    if (!vinMatch) {
      return res.status(403).json({ message: "VIN does not match records." });
    }

    // ✅ VIN verified: generate reset token
    const token = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    return res.status(200).json({
      message: "VIN verified. Proceed to reset password.",
      resetToken: token,
    });
  } catch (error) {
    console.error("❌ VIN verification error:", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};












// Enable 2FA
exports.enable2FA = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const secret = authenticator.generateSecret();
    user.twoFactorSecret = secret;
    user.twoFactorEnabled = true;

    await user.save();

    const otpauthUrl = authenticator.keyuri(user.email, "Skynetrix", secret);
    res.status(200).json({ message: "2FA enabled", otpauthUrl });
  } catch (error) {
    console.error("Error enabling 2FA:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Verify 2FA
exports.verify2FA = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || !user.twoFactorEnabled) {
      return res
        .status(404)
        .json({ message: "2FA is not enabled for this user." });
    }

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid 2FA code." });
    }

    res.status(200).json({ message: "2FA verification successful." });
  } catch (error) {
    console.error("Error verifying 2FA:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.socialLogin = async (req, res) => {
  try {
    const { token, provider } = req.body;

    if (provider !== "google") {
      return res.status(400).json({ message: "Unsupported provider." });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub } = payload; // `sub` is the Google user ID

    // Find or create the user
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        name,
        password: null, // Social logins don't need a password
        "verification.isEmailVerified": true,
        socialId: sub, // Store the Google user ID
      });
      await user.save();
    }

    // Generate a JWT
    const jwtToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Social login successful",
      token: jwtToken,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error("Social login error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    const userId = req.user.id; // Assumes user ID is added to `req.user` via middleware after JWT verification

    // Find the user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if 2FA is already disabled
    if (!user.twoFactorEnabled) {
      return res
        .status(400)
        .json({ message: "Two-factor authentication is already disabled." });
    }

    // Disable 2FA by updating the user's profile
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null; // Remove the 2FA secret, if applicable
    await user.save();

    res
      .status(200)
      .json({ message: "Two-factor authentication has been disabled." });
  } catch (error) {
    console.error("Error disabling 2FA:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
