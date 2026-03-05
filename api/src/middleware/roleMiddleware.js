const { createSystemLog } = require("../services/systemLogService");

const roleMiddleware = (requiredRole) => {
  return async (req, res, next) => {
    // authMiddleware must run first
    if (!req.user || !req.user.role) {
      await createSystemLog({
        severity: "Warning",
        event: "Permission denied",
        description: `Access denied for ${req.originalUrl}: missing authenticated role`,
        status: "Failed",
        metadata: {
          path: req.originalUrl,
          method: req.method,
          requiredRole
        }
      });
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user.role !== requiredRole) {
      await createSystemLog({
        severity: "Warning",
        event: "Permission denied",
        description: `Role ${req.user.role} blocked from ${req.originalUrl}`,
        status: "Failed",
        actorId: req.user.id,
        actorRole: req.user.role,
        metadata: {
          path: req.originalUrl,
          method: req.method,
          requiredRole
        }
      });
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

module.exports = roleMiddleware;
