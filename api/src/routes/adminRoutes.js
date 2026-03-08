const express = require("express");
const router = express.Router();

const {
  createDestination,
  getAllDestinationsAdmin,
  updateDestination,
  backfillDestinationInterests,
  deleteDestination,
  uploadDestinationImage,
  deleteDestinationImage,
  getAllUsers,
  getAllItineraries,
  getSystemLogs,
  getRoutePreview,
  getDestinationTaxonomy,
  replaceDestinationTaxonomy,
  createDestinationCategory,
  updateDestinationCategory,
  deleteDestinationCategory,
  createDestinationFeature,
  updateDestinationFeature,
  deleteDestinationFeature,
  getCloudinaryUploadSignature,
  getRatingsSummary,
  getRatingsByDestination,
  getFeedbackEvents,
  getFeedbackSummary,
  getAdminComments
} = require("../controllers/adminController");

const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

router.post(
  "/destinations",
  auth,
  role("admin"),
  createDestination
);

router.put("/destinations/:id", auth, role("admin"), updateDestination);
router.post("/destinations/backfill-interests", auth, role("admin"), backfillDestinationInterests);
router.delete("/destinations/:id", auth, role("admin"), deleteDestination);
router.get("/destinations", auth, role("admin"), getAllDestinationsAdmin);

router.get("/destination-taxonomy", auth, role("admin"), getDestinationTaxonomy);
router.put("/destination-taxonomy", auth, role("admin"), replaceDestinationTaxonomy);
router.post("/destination-taxonomy/categories", auth, role("admin"), createDestinationCategory);
router.put("/destination-taxonomy/categories/:category", auth, role("admin"), updateDestinationCategory);
router.delete("/destination-taxonomy/categories/:category", auth, role("admin"), deleteDestinationCategory);
router.post("/destination-taxonomy/categories/:category/features", auth, role("admin"), createDestinationFeature);
router.put("/destination-taxonomy/categories/:category/features/:feature", auth, role("admin"), updateDestinationFeature);
router.delete("/destination-taxonomy/categories/:category/features/:feature", auth, role("admin"), deleteDestinationFeature);

router.get("/users", auth, role("admin"), getAllUsers);
router.get("/itineraries", auth, role("admin"), getAllItineraries);
router.get("/logs", auth, role("admin"), getSystemLogs);
router.get("/ratings/summary", auth, role("admin"), getRatingsSummary);
router.get("/ratings/destination/:id", auth, role("admin"), getRatingsByDestination);
router.get("/feedback/events", auth, role("admin"), getFeedbackEvents);
router.get("/feedback/summary", auth, role("admin"), getFeedbackSummary);
router.get("/comments", auth, role("admin"), getAdminComments);
router.post("/routes/preview", auth, role("admin"), getRoutePreview);
router.post("/cloudinary/signature", auth, role("admin"), getCloudinaryUploadSignature);

router.post(
  "/destinations/:id/images",
  auth,
  role("admin"),
  uploadDestinationImage
);

router.delete(
  "/destinations/:id/images/:imageIndex",
  auth,
  role("admin"),
  deleteDestinationImage
);

module.exports = router;
