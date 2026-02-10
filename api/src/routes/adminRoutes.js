const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");





const {
  createDestination,
  getAllDestinationsAdmin,
  updateDestination,
  deleteDestination,
  uploadDestinationImage,
  deleteDestinationImage,
  getAllUsers,
  getAllItineraries,
  getRoutePreview
} = require("../controllers/adminController");

const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

router.post("/destinations", auth, role("admin"), createDestination);

router.put("/destinations/:id", auth, role("admin"), updateDestination);
router.delete("/destinations/:id", auth, role("admin"), deleteDestination);
router.get("/destinations", auth, role("admin"), getAllDestinationsAdmin);

router.get("/users", auth, role("admin"), getAllUsers);
router.get("/itineraries", auth, role("admin"), getAllItineraries);
router.post("/routes/preview", auth, role("admin"), getRoutePreview);

router.post(
  "/destinations/:id/images",
  auth,
  role("admin"),
  upload.array("images", 4),
  uploadDestinationImage
);


router.delete(
  "/destinations/:id/images/:imageIndex",
  auth,
  role("admin"),
  deleteDestinationImage
);



module.exports = router;
