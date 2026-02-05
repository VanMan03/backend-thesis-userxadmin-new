const express = require("express");
const router = express.Router();
const {
  createDestination,
  updateDestination,
  deleteDestination
} = require("../controllers/adminController");

const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

router.post("/destinations", auth, role("admin"), createDestination);

router.put("/destinations/:id", auth, role("admin"), updateDestination);
router.delete("/destinations/:id", auth, role("admin"), deleteDestination);

module.exports = router;
