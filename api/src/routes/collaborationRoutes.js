const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const {
  getNotifications,
  markNotificationRead,
  createInvitation,
  respondInvitation,
  syncItinerary
} = require("../controllers/collaborationController");

router.get("/notifications", auth, getNotifications);
router.post("/notifications/:id/read", auth, markNotificationRead);

router.post("/invitations", auth, createInvitation);
router.post("/invitations/:id/respond", auth, respondInvitation);

router.post("/sync", auth, syncItinerary);

module.exports = router;
