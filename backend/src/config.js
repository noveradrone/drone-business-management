module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  dbPath: process.env.DB_PATH || "./drone-business.db",
  googleReviewLink: process.env.GOOGLE_REVIEW_LINK || "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioFromPhone: process.env.TWILIO_FROM_PHONE || ""
};
