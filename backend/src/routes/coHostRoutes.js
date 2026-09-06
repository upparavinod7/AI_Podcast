const express = require("express");

const {
  generateCoHostController,
} = require("../controllers/coHostController");

const {
  generateCueTimeline,
} = require("../controllers/cueTimelineController");

const router =
  express.Router();

// ============================================================
// GENERATE AI CO-HOST
// POST /api/cohost/generate
// ============================================================

router.post(
  "/generate",
  generateCoHostController
);

// ============================================================
// GENERATE AI CO-HOST CUE TIMELINE
// POST /api/cohost/timeline
// ============================================================

router.post(
  "/timeline",
  generateCueTimeline
);

module.exports = router;