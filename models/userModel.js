const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const IncentiveSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "Hourly Bonus", // e.g., time and a half over X hours
        "Flat Bonus", // e.g., $100 bonus
        "Point-Based Reward", // gamified incentives
        "Perk", // e.g., lunch choice
        "Other",
      ],
      required: true,
    },
    description: String,
    triggerCondition: String, // plain-text or rule engine string, e.g., "flaggedHours > 40"
    rewardValue: mongoose.Schema.Types.Mixed, // string, number, etc. based on type
    recurring: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const TechnicianProfileSchema = new mongoose.Schema(
  {
    certifications: [String],
    specialties: [String],
    hourlyRate: Number,
    flatRate: Number,

    availability: {
      daysAvailable: [String], // e.g., ["Mon", "Tue", "Wed"]
      hours: {
        start: String, // "08:00"
        end: String, // "17:00"
      },
    },

    benefits: {
      healthCare: { type: Boolean, default: false },
      dental: { type: Boolean, default: false },
      vision: { type: Boolean, default: false },
      aflac: { type: Boolean, default: false },
      retirement401k: { type: Boolean, default: false },
      matching401k: { type: Number }, // % match, e.g., 5 for 5%
    },

    incentives: [IncentiveSchema],

    performanceStats: {
      flaggedHoursThisWeek: { type: Number, default: 0 },
      totalBonusesEarned: { type: Number, default: 0 },
      incentivePoints: { type: Number, default: 0 },
    },

    assignedJobs: [
      { type: mongoose.Schema.Types.ObjectId, ref: "RepairOrder.itemsSnapshop.id" },
    ],
  },
);



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
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    birthday: { type: Date },
    shopIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ShopProfile",
      },
    ],
    lastVisitedShopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShopProfile",
    },
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
      default: "customer", // Still gives a fallback
    },

    roles: [
      {
        type: String, // e.g., "A Tech", "Shop Foreman", "SEO Specialist"
        primary: { type: Boolean, default: false },
      },
    ],
    stripeCustomerId: { type: String, required: false },
    paymentMethods: [
      {
        stripePaymentMethodId: { type: String, required: true }, // e.g., pm_123
        brand: String, // e.g., 'visa'
        last4: String, // e.g., '4242'
        expMonth: Number, // e.g., 12
        expYear: Number, // e.g., 2026
        fingerprint: String, // Optional: dedupe logic
        isFavorite: { type: Boolean, default: false },
        addedAt: { type: Date, default: Date.now },
      },
    ],
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

    shopProfiles: [
      {
        shopProfileId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ShopProfile",
        },
        receiveNotifications: {
          sms: { type: Boolean, default: false },
          email: { type: Boolean, default: false },
          push: { type: Boolean, default: false },
        },
        favorite: { type: Boolean, default: false },
        lastVisitedAt: { type: Date },
      },
    ],

    technicianProfile: {
      type: TechnicianProfileSchema,
      required: false,
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
    tokenVersion: {
      type: Number,
      default: 0,
    },
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }, // Automatically adds createdAt and updatedAt fields
  }
);
userSchema.pre("save", function (next) {
  if (this.generalRole !== "Technician") {
    this.technicianProfile = undefined;
  }
  next();
});
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


userSchema.virtual("name").get(function () {
  return `${this.firstName} ${this.lastName}`;
});


module.exports = mongoose.model("User", userSchema);
