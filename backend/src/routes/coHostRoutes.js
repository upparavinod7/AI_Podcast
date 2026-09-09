const express = require("express");

const { generateCoHostController } = require("../controllers/coHostController");

const { generateCueTimeline } = require("../controllers/cueTimelineController");

const router = express.Router();

router.post("/generate", generateCoHostController);

router.post("/timeline", generateCueTimeline);

module.exports = router;
