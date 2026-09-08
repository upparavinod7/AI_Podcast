const express = require("express");

const {
  generateSpeechController,
  getAudioController
} = require("../controllers/ttsController");

const router =
  express.Router();


router.post(
  "/speech",
  generateSpeechController
);


router.get(
  "/audio/:fileName",
  getAudioController
);

module.exports = router;