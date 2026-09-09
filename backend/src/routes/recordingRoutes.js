const express = require("express");
const multer = require("multer");

const recordingController = require("../controllers/recordingController");

const audioMixController = require("../controllers/audioMixController");

const router = express.Router();

const upload = multer({
  dest: "outputs/tmp-recording-uploads",

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = [
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Unsupported audio type: ${file.mimetype}`));
  },
});

router.post("/sessions", recordingController.createSession);

router.post(
  "/sessions/:sessionId/chunks",
  upload.single("audio"),
  recordingController.uploadChunk,
);

router.get("/sessions/:sessionId/status", recordingController.getSessionStatus);

router.post(
  "/sessions/:sessionId/finalize",
  recordingController.finalizeSession,
);

router.post("/sessions/:sessionId/mix", audioMixController.mixSession);

router.get(
  "/sessions/:sessionId/mix/:format",
  audioMixController.getMixedAudio,
);

router.get(
  "/sessions/:sessionId/mix/:format/download",
  audioMixController.getMixedAudio,
);

router.get(
  "/sessions/:sessionId/transcript",
  audioMixController.getTranscript,
);

router.get(
  "/sessions/:sessionId/final",
  recordingController.getFinalRecordingFile,
);

module.exports = router;
