const express = require("express");
const router = express.Router();

const {
  createDestination,
  updateDestination,
  deleteDestination,
  getAllUsers,
  getAllItineraries
} = require("../controllers/adminController");

const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

router.post("/destinations", auth, role("admin"), createDestination);

router.put("/destinations/:id", auth, role("admin"), updateDestination);
router.delete("/destinations/:id", auth, role("admin"), deleteDestination);

router.get("/users", auth, role("admin"), getAllUsers);
router.get("/itineraries", auth, role("admin"), getAllItineraries);


module.exports = router;
