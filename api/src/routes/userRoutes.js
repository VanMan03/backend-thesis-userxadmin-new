const express = require("express");
const router = express.Router();
const {
  getProfile,
  updatePreferences,
  searchUsers
} = require("../controllers/userController");

const auth = require("../middleware/authMiddleware");

router.get("/profile", auth, getProfile);
router.get("/search", auth, searchUsers);
router.put("/preferences", auth, updatePreferences);

module.exports = router;
