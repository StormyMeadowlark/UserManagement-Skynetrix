const User = require("../models/userModel");
const jwt = require("jsonwebtoken");

exports.createUser = async (userData) => {
  const user = new User(userData);
  return user.save();
};

exports.authenticateUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    throw new Error("Invalid credentials");
  }
  return jwt.sign(
    { id: user._id, role: user.role, tenantId: user.tenantId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};
