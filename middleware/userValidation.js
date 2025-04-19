const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

exports.validateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"
  if (!token) {
    return res.status(401).json({ message: "Unauthorized access." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." }); // 🔥 FIX: Return 404 instead of 401
    }

    req.user = { id: user._id }; // Attach user ID to `req.user`
    next();
  } catch (error) {
    console.error("Token validation error:", error);
    res.status(401).json({ message: "Unauthorized access." });
  }
};

exports.authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"
  if (!token) {
    return res.status(401).json({ message: "Unauthorized access." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;
    try {
      user = await User.findById(decoded.id);
    } catch (dbError) {
      console.error("🔥 Database error in authMiddleware:", dbError);
      return res
        .status(500)
        .json({ message: "Authentication failed due to a database error." }); // ✅ FIX: Return 500 if DB fails
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.status !== "Active") {
      return res.status(403).json({ message: "Account is not active." });
    }

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      tenantIds: user.tenantIds,
    }; // Attach user info to `req.user`

    next();
  } catch (error) {
    console.error("❌ Token validation error:", error);
    res.status(401).json({ message: "Unauthorized access." });
  }
};

exports.adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: "Unauthorized access." });
  }

  const allowedRoles = ["admin", "tenantAdmin"];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  next();
};