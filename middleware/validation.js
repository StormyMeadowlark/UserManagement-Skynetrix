const { check, validationResult } = require("express-validator");

// Validation rules for registration
exports.validateRegister = [
  check("email").isEmail().withMessage("Must be a valid email"),
  check("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  check("name").not().isEmpty().withMessage("Name is required"),
];

// Validation rules for login
exports.validateLogin = [
  check("email").isEmail().withMessage("Must be a valid email"),
  check("password").not().isEmpty().withMessage("Password is required"),
];

// Middleware to handle validation results
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

