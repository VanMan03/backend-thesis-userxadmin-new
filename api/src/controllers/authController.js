//This controller manages user authentication: registration and login
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createSystemLog } = require("../services/systemLogService");

exports.register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      password: hashedPassword
    });

    await createSystemLog({
      severity: "Success",
      event: "User registered",
      description: `User registration completed for ${user.email}`,
      status: "Success",
      actorId: user._id,
      actorRole: user.role,
      metadata: { email: user.email }
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    await createSystemLog({
      severity: "Error",
      event: "User registration failed",
      description: err.message,
      status: "Failed",
      metadata: { email: req.body?.email || null }
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      await createSystemLog({
        severity: "Warning",
        event: "Login failed",
        description: `Login failed for unknown email: ${email || "unknown"}`,
        status: "Failed",
        metadata: { email }
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      if (user.role === "admin") {
        await createSystemLog({
          severity: "Warning",
          event: "Admin login failed",
          description: `Failed admin login for ${user.email}`,
          status: "Failed",
          actorId: user._id,
          actorRole: user.role,
          metadata: { email: user.email }
        });
      }
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    await createSystemLog({
      severity: "Success",
      event: user.role === "admin" ? "Admin login successful" : "User login successful",
      description: `${user.role === "admin" ? "Admin" : "User"} ${user.email} signed in.`,
      status: "Success",
      actorId: user._id,
      actorRole: user.role,
      metadata: { email: user.email }
    });

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    await createSystemLog({
      severity: "Error",
      event: "Login error",
      description: err.message,
      status: "Failed",
      metadata: { email: req.body?.email || null }
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
