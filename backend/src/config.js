const allowedOrigins = String(
  process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  dbPath: process.env.DB_PATH || "./drone-business.db",
  uploadsDir: process.env.UPLOADS_DIR || "./uploads",
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "30mb",
  urlencodedBodyLimit: process.env.URLENCODED_BODY_LIMIT || "10mb",
  documentsMaxBytes: Number(process.env.DOCUMENTS_MAX_BYTES || 10 * 1024 * 1024),
  allowDefaultAdmin: String(process.env.ALLOW_DEFAULT_ADMIN || "false") === "true",
  allowedOrigins,
  googleReviewLink: process.env.GOOGLE_REVIEW_LINK || "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioFromPhone: process.env.TWILIO_FROM_PHONE || ""
};
