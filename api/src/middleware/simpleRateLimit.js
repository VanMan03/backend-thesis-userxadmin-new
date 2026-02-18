const buckets = new Map();

function simpleRateLimit({ windowMs, maxRequests }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return res.status(429).json({
        message: "Too many requests. Please try again later."
      });
    }

    current.count += 1;
    return next();
  };
}

module.exports = { simpleRateLimit };
