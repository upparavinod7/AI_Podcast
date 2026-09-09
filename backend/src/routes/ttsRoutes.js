const express = require("express");

const {
  generateSpeechController,
  getVoicesController,
  getAudioController,
} = require("../controllers/ttsController");

const router = express.Router();

// Get available AI voices
router.get("/voices", getVoicesController);

// Generate speech
router.post("/speech", generateSpeechController);

// Stream generated audio
router.get("/audio/:fileName", getAudioController);

module.exports = router;
