const express = require("express");
const router = express.Router();
const { setStripeCustomerId, getUserStripeData } = require("../controllers/internalController");
const validateApiKey = require("../middleware/apiKeyMiddleware");

router.put("/users/:id/stripe", validateApiKey, setStripeCustomerId);
router.get("/users/:id/stripe",validateApiKey, getUserStripeData);
//router.put("/stripe/card", updateStripeCard);

module.exports = router;
