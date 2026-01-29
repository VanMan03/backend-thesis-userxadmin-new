const roleMiddleware = (requiredRole) => {
  return (req, res, next) => {
    // authMiddleware must run first
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

module.exports = roleMiddleware;
