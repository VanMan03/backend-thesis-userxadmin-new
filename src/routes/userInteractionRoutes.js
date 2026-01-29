const express = require("express");
const router = express.Router();
const {
  logInteraction
} = require("../controllers/userInteractionController");

const auth = require("../middleware/authmiddleware");

router.post("/", auth, logInteraction);

module.exports = router;
