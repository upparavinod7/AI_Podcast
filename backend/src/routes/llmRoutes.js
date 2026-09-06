const express = require("express");

const {
  generateTalkingPointsController
} = require("../controllers/llmController");

const router = express.Router();

router.post(
  "/talking-points",
  generateTalkingPointsController
);

module.exports = router;