const mongoose = require("mongoose");
const bcrypt = require("bcrypt");



const userGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  type: {
    type: String,
    enum: ["family", "business", "fleet", "custom", "shop", "sales"],
    default: "custom",
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],

  primaryContact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },


  inviteOnly: { type: Boolean, default: true }, // default behavior
  accessCode: { type: String, required: true, select: false }, // like a join password

  invitedUsers: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: {
        type: String,
        enum: ["pending", "accepted", "declined"],
        default: "pending",
      },
      invitedAt: { type: Date, default: Date.now },
    },
  ],

  isArchived: {
    type: Boolean,
    default: false,
  },

  tags: [String],
  notes: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});


// 🔍 Virtual: Pull all vehicles owned by members
userGroupSchema.virtual("vehicles", {
  ref: "Vehicle",
  localField: "members",
  foreignField: "ownerId",
});

userGroupSchema.set("toJSON", { virtuals: true });
userGroupSchema.set("toObject", { virtuals: true });

userGroupSchema.pre("save", async function (next) {
  if (!this.isModified("accessCode") || !this.accessCode) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.accessCode = await bcrypt.hash(this.accessCode, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// 🔍 Method to validate a code
userGroupSchema.methods.compareAccessCode = async function (candidateCode) {
  return bcrypt.compare(candidateCode, this.accessCode);
};

module.exports = mongoose.model("UserGroup", userGroupSchema);
