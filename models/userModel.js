const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Invalid email format",
      },
    },
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
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String },
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    birthday: { type: Date },
    marketing: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    notifications: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
    vehicles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
      },
    ],
    role: {
      type: String,
      enum: ["user", "admin", "tenantAdmin"],
      default: "user",
    },
    tenantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
      },
    ],
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      language: { type: String, default: "en-US" },
    },
    verification: {
      isEmailVerified: { type: Boolean, default: false },
      verifyEmailToken: { type: String, default: null },
      verifyEmailExpires: { type: Date, default: null },
    },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    loginHistory: [
      {
        ipAddress: { type: String },
        timestamp: { type: Date, default: Date.now },
        device: { type: String },
      },
    ],
    lastActivityAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    accountLockedUntil: { type: Date, default: null },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    deletionScheduledAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Hash the password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Add method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
