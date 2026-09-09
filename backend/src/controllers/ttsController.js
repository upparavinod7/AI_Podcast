const fs = require("fs");
const path = require("path");

const {
  generateSpeech,
  getAvailableVoices,
} = require("../services/ttsService");

/*
 * GET /api/tts/voices
 *
 * Returns all voices available to the frontend.
 */
function getVoicesController(req, res) {
  try {
    return res.status(200).json({
      success: true,
      voices: getAvailableVoices(),
    });
  } catch (error) {
    console.error("Get TTS voices error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load voices",
    });
  }
}

/*
 * POST /api/tts/speech
 *
 * Body:
 * {
 *   "text": "Hello",
 *   "voice": "alex"
 * }
 */
async function generateSpeechController(req, res) {
  try {
    const { text, voice = "alex" } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    const trimmedText = text.trim();

    if (!trimmedText) {
      return res.status(400).json({
        success: false,
        error: "Text cannot be empty",
      });
    }

    const result = await generateSpeech(trimmedText, voice);

    return res.status(200).json({
      success: true,
      audio: result,
    });
  } catch (error) {
    console.error("TTS error:", error);

    if (error.code === "INVALID_VOICE") {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate speech",
    });
  }
}

/*
 * GET /api/tts/audio/:fileName
 */
function getAudioController(req, res) {
  try {
    const { fileName } = req.params;

    if (!fileName || !/^tts-\d+(-(alex|leo|maaya))?\.wav$/i.test(fileName)) {
      return res.status(400).json({
        success: false,
        error: "Invalid audio filename",
      });
    }

    const outputDir = path.resolve(process.cwd(), "outputs", "tts");

    const filePath = path.join(outputDir, fileName);

    const resolvedFilePath = path.resolve(filePath);

    if (!resolvedFilePath.startsWith(outputDir + path.sep)) {
      return res.status(400).json({
        success: false,
        error: "Invalid audio path",
      });
    }

    if (!fs.existsSync(resolvedFilePath)) {
      return res.status(404).json({
        success: false,
        error: "Audio file not found",
      });
    }

    const stats = fs.statSync(resolvedFilePath);

    if (!stats.isFile() || stats.size === 0) {
      return res.status(404).json({
        success: false,
        error: "Audio file is unavailable",
      });
    }

    res.setHeader("Content-Type", "audio/wav");

    res.setHeader("Content-Length", String(stats.size));

    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    res.setHeader("Accept-Ranges", "bytes");

    return res.sendFile(resolvedFilePath);
  } catch (error) {
    console.error("TTS audio streaming error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load audio",
    });
  }
}

module.exports = {
  getVoicesController,
  generateSpeechController,
  getAudioController,
};
