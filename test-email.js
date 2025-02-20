require("dotenv").config();
const { sendEmail } = require("./utils/email");

sendEmail(
  "ashlee.herken@gmail.com",
  "Test Email from Skynetrix",
  "<h1>Hello from SendGrid via Nodemailer!</h1>"
)
  .then(() => console.log("✅ Email sent successfully!"))
  .catch((error) => console.error("❌ Failed to send email:", error.message));
