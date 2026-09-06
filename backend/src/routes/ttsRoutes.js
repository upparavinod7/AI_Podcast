const express = require("express");

const {
  generateSpeechController,
  getAudioController
} = require("../controllers/ttsController");

const router =
  express.Router();

// ============================================================
// GENERATE TTS
// ============================================================

router.post(
  "/speech",
  generateSpeechController
);

// ============================================================
// STREAM GENERATED TTS AUDIO
// ============================================================

router.get(
  "/audio/:fileName",
  getAudioController
);

module.exports = router;