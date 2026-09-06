const express = require("express");
const multer = require("multer");

const recordingController =
  require("../controllers/recordingController");

const audioMixController =
  require("../controllers/audioMixController");

const router =
  express.Router();

const upload = multer({
  dest:
    "outputs/tmp-recording-uploads",

  limits: {
    fileSize:
      10 * 1024 * 1024,
  },

  fileFilter: (
    req,
    file,
    callback
  ) => {
    const allowedMimeTypes = [
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
    ];

    if (
      allowedMimeTypes.includes(
        file.mimetype
      )
    ) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        `Unsupported audio type: ${file.mimetype}`
      )
    );
  },
});

// ============================================================
// CREATE SESSION
// ============================================================

router.post(
  "/sessions",
  recordingController.createSession
);

// ============================================================
// UPLOAD CHUNK
// ============================================================

router.post(
  "/sessions/:sessionId/chunks",
  upload.single("audio"),
  recordingController.uploadChunk
);

// ============================================================
// GET SESSION STATUS
// ============================================================

router.get(
  "/sessions/:sessionId/status",
  recordingController.getSessionStatus
);

// ============================================================
// FINALIZE RECORDING
// ============================================================

router.post(
  "/sessions/:sessionId/finalize",
  recordingController.finalizeSession
);

// ============================================================
// MIX FINAL HOST RECORDING WITH AI CUE TIMELINE
// ============================================================

router.post(
  "/sessions/:sessionId/mix",
  audioMixController.mixSession
);

// ============================================================
// GET / STREAM FINAL MIXED PODCAST
// ============================================================

router.get(
  "/sessions/:sessionId/mix/:format",
  audioMixController.getMixedAudio
);

// ============================================================
// GET / STREAM FINAL RECORDING
// ============================================================

router.get(
  "/sessions/:sessionId/final",
  recordingController.getFinalRecordingFile
);

module.exports = router;
