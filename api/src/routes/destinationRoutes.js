const express = require("express");
const router = express.Router();
const {
  getAllDestinations,
  getDestinationById
} = require("../controllers/destinationController");

// Public (or optionally authenticated)
router.get("/", getAllDestinations);
router.get("/:id", getDestinationById);

module.exports = router;
