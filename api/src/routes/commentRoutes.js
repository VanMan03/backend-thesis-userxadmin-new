const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");
const {
  deleteComment,
  updateCommentModeration
} = require("../controllers/commentController");

router.delete("/:commentId", auth, role("admin"), deleteComment);
router.patch("/:commentId", auth, role("admin"), updateCommentModeration);

module.exports = router;
