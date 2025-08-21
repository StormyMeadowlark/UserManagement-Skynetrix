const User = require("../models/userModel");


exports.setStripeCustomerId = async (req, res) => {
  const { id } = req.params;
  const { stripeCustomerId } = req.body;

  if (!stripeCustomerId || !stripeCustomerId.startsWith("cus_")) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid Stripe customer ID." });
  }

  try {
    const user = await User.findByIdAndUpdate(
      id,
      { stripeCustomerId },
      { new: true }
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    return res
      .status(200)
      .json({ success: true, message: "Stripe ID updated.", user });
  } catch (err) {
    console.error("❌ Error setting Stripe ID:", err);
    return res.status(500).json({ success: false, message: "Internal error." });
  }
};

// GET /internal/users/:id/stripe
exports.getUserStripeData = async (req, res) => {
  try {
    const { id } = req.params;

    // Optional: Auth check
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const user = await User.findById(id).select("stripeCustomerId savedCards");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        stripeCustomerId: user.stripeCustomerId,
        savedCards: user.savedCards || [],
      },
    });
  } catch (err) {
    console.error("❌ Failed to fetch Stripe data:", err.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};


exports.updateStripeCard = async (req, res) => {
  const { stripeCustomerId, paymentMethod } = req.body;

  if (!stripeCustomerId || !paymentMethod?.stripePaymentMethodId) {
    return res.status(400).json({ message: "Missing required card info." });
  }

  try {
    const user = await User.findOne({ stripeCustomerId });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.savedCards = user.savedCards || [];

    // Prevent duplicate cards
    const alreadyExists = user.savedCards.some(
      (card) =>
        card.stripePaymentMethodId === paymentMethod.stripePaymentMethodId
    );
    if (alreadyExists) {
      return res.status(200).json({ message: "Card already saved." });
    }

    // Mark first card as favorite
    const isFirstCard = user.savedCards.length === 0;

    user.savedCards.push({
      ...paymentMethod,
      isFavorite: isFirstCard,
    });

    await user.save();

    return res.status(200).json({ message: "Card saved successfully." });
  } catch (err) {
    console.error("❌ Failed to update saved card:", err.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};