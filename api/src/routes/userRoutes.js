const express = require("express");
const router = express.Router();
const {
  getProfile,
  updatePreferences
} = require("../controllers/userController");

const auth = require("../middleware/authMiddleware");

router.get("/profile", auth, getProfile);
router.put("/preferences", auth, updatePreferences);

module.exports = router;
