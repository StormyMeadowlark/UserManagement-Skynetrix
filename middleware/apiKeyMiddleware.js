module.exports = (req, res, next) => {
  console.log("🔐 User-management API Key Check");
  console.log("Headers received:", req.headers);
  console.log("Expected INTERNAL_API_KEY:", process.env.INTERNAL_API_KEY);

  const receivedKey = req.headers["x-api-key"];
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!receivedKey || receivedKey !== expectedKey) {
    console.warn("🔒 Unauthorized access attempt. Received:", receivedKey);
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or missing API key" });
  }

  next();
};
