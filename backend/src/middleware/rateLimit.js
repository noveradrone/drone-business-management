function createRateLimiter({ windowMs, max, keyFn, message }) {
  const store = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn(req);
    const entry = store.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count += 1;
    store.set(key, entry);

    if (entry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message });
    }

    return next();
  };
}

const authLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `login:${req.ip}:${String(req.body?.email || "").toLowerCase()}`,
  message: "Trop de tentatives de connexion. Reessayez plus tard."
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  keyFn: (req) => `api:${req.ip}`,
  message: "Trop de requetes. Merci de ralentir."
});

module.exports = {
  createRateLimiter,
  authLoginLimiter,
  apiLimiter
};
