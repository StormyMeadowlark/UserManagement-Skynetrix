const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { authenticator } = require("otplib");
const { sendEmail } = require("../utils/email");
const { loadTemplate } = require("../utils/templateLoader");
const { OAuth2Client } = require("google-auth-library");




const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// Register a new user
exports.register = async (req, res) => {
  try {
    const { email, password, name, birthday, marketing } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    // Check if email is already in use
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists." });
    }

    // Create a verification token
    const verifyEmailToken = crypto.randomBytes(32).toString("hex");
    const verifyEmailExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create the new user
    const user = new User({
      email,
      password,
      name,
      birthday,
      marketing,
      verification: {
        isEmailVerified: false,
        verifyEmailToken,
        verifyEmailExpires,
      },
    });

    // Save the user to the database
    await user.save();
    console.log("User created successfully in MongoDB:", user._id);

    // Load the email template and send verification email
    const template = loadTemplate("verify-email");
    const tenantDomain = req.headers.origin || "https://skynetrix.tech";
    const emailBody = template
      .replace("{{name}}", user.name)
      .replace(
        "{{verifyEmailLink}}",
        `${tenantDomain}/verify-email?token=${verifyEmailToken}`
      );

    await sendEmail(user.email, "Verify Your Email", emailBody);
    console.log(`Verification email sent to ${user.email}`);

    // Return success response
    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      userId: user._id, // Optional: Return the new user's ID
    });
  } catch (error) {
    console.error("Error during registration:", error);

    // If user creation was successful but email sending failed, delete the user
    if (error.message.includes("Failed to send email")) {
      await User.deleteOne({ email: req.body.email });
      console.log("User deleted due to email sending failure.");
    }

    res.status(500).json({ message: "Internal server error." });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email && !password) {
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

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// Log out the user
exports.logout = (req, res) => {
  // For stateless JWT, there's no logout mechanism. Tokens can only be invalidated via expiration or blacklisting.
  res.status(200).json({ message: "Logout successful." });
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

    // Check if the user's email is verified
    if (!user.verification?.isEmailVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email to use this feature." });
    }

    // Generate a new access token
    const newToken = jwt.sign(
      { id: user._id, role: user.role, tenantIds: user.tenantIds },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
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
      return res.status(400).json({ message: "Token and new password are required." });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Ensure token is not expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

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

    // Ensure both old and new passwords are provided
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Both old and new passwords are required." });
    }

    const userId = req.user.id; // Assumes middleware attaches the user ID to the request

    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if the old password matches
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect." });
    }

    // Validate new password strength (optional)
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters long." });
    }

    // Update the user's password
    user.password = newPassword; // Assuming password hashing is handled in the User model's pre-save middleware
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
    const { email, recoveryDetails } = req.body;

    if (!email || !recoveryDetails) {
      return res
        .status(400)
        .json({ message: "Email and recovery details are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Load and send account recovery email
    const template = loadTemplate("account-recovery");
    const emailBody = template
      .replace("{{name}}", user.name)
      .replace("{{recoveryDetails}}", recoveryDetails);

    await sendEmail(user.email, "Account Recovery Instructions", emailBody);

    res
      .status(200)
      .json({ message: "Account recovery email sent successfully." });
  } catch (error) {
    console.error("Error in account recovery:", error);
    res.status(500).json({ message: "Internal server error." });
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
