const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { createSystemLog } = require("../services/systemLogService");

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      await createSystemLog({
        severity: "Warning",
        event: "Authentication failed",
        description: "Request rejected: missing bearer token",
        status: "Failed",
        metadata: {
          path: req.originalUrl,
          method: req.method
        }
      });
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Attach user info to request
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      await createSystemLog({
        severity: "Warning",
        event: "Authentication failed",
        description: "Request rejected: token user not found",
        status: "Failed",
        metadata: {
          path: req.originalUrl,
          method: req.method
        }
      });
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: user._id,
      role: user.role
    };

    // 4. Continue to next middleware / controller
    next();
  } catch (err) {
    await createSystemLog({
      severity: "Warning",
      event: "Authentication failed",
      description: "Request rejected: invalid or expired token",
      status: "Failed",
      metadata: {
        path: req.originalUrl,
        method: req.method
      }
    });
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
