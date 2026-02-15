module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  dbPath: process.env.DB_PATH || "./drone-business.db"
};
