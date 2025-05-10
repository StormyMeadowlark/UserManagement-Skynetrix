const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    /** 🔹 Basic User Info */
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      validate: {
        validator: function (email) {
          return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Invalid email format",
      },
    },
    isProvisioned: { type: Boolean, default: false },
    phone: {
      type: String,
      validate: {
        validator: function (phone) {
          return /^\+?[1-9]\d{1,14}$/.test(phone); // E.164 format
        },
        message: "Invalid phone number format",
      },
    },
    secondaryPhone: {
      type: String,
      validate: {
        validator: function (phone) {
          return !phone || /^\+?[1-9]\d{1,14}$/.test(phone); // Optional
        },
        message: "Invalid secondary phone number format",
      },
    },
    name: { type: String, required: true, trim: true },
    birthday: { type: Date },

    /** 🔹 Address */
    address: {
      addressLine1: { type: String },
      addressLine2: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
      country: { type: String },
    },

    /** 🔹 Role & Permissions */
    role: {
      type: String,
      enum: ["user", "admin", "tenantAdmin"],
      default: "user",
    },
    permissions: [{ type: String }], // Stores specific permissions (e.g., "canManageCustomers", "canViewReports")

    tenantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tenant" }],
    generalRole: {
      type: String,
      default: "employee", // Still gives a fallback
    },
    /** 🔹 Shopware Integration */
    shopwareUserId: {
      type: String,
      unique: true,
      sparse: true,
      default: undefined,
    }, // Stores Shopware User ID
    shopwareRole: { type: String }, // Role from Shopware (e.g., "shopAdmin", "serviceAdvisor")

    /** 🔹 Security */
    password: {
      type: String,
      minlength: 6,
      required: function () {
        return !this.isProvisioned;
      },
    },
    passwordUpdatedAt: { type: Date }, // Tracks last password change
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorMethods: [
      {
        type: String,
        enum: ["email", "sms", "app"],
      },
    ], // Supports multiple 2FA options

    verification: {
      isEmailVerified: { type: Boolean, default: false },
      verifyEmailToken: { type: String, default: null },
      verifyEmailExpires: { type: Date, default: null },
    },

    /** 🔹 Notifications & Marketing Preferences */
    marketing: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    notifications: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },

    /** 🔹 User Preferences */
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      language: { type: String, default: "en-US" },
    },
    userPreferences: {
      dashboardLayout: { type: String, default: "default" }, // Stores user’s preferred dashboard setup
    },

    /** 🔹 Activity Tracking */
    loginHistory: [
      {
        ipAddress: { type: String },
        timestamp: { type: Date, default: Date.now },
        device: { type: String },
      },
    ],
    lastLoginAt: { type: Date }, // Stores last login timestamp
    lastActivityAt: { type: Date }, // Tracks last user activity

    /** 🔹 Account Management */
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
    failedLoginAttempts: { type: Number, default: 0 },
    accountLockedUntil: { type: Date, default: null },

    /** 🔹 Password Reset & Account Deletion */
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    deletionScheduledAt: { type: Date, default: null },

    /** 🔹 Audit Logs */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleted: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

/** 🔹 Hash the password before saving */
userSchema.pre("save", async function (next) {
  // Only hash password if it’s modified and actually present
  if (!this.isModified("password")) return next();

  if (!this.password) {
    return next(); // Skip hashing if password is empty (provisional user)
  }

  try {
    this.password = await bcrypt.hash(this.password, 10);
    this.passwordUpdatedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});


/** 🔹 Add method to compare passwords */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
