const {
  createRecordingSession,
  saveRecordingChunk,
  getRecordingSessionStatus,
  finalizeRecording,
  getFinalRecording,
} = require("../services/recordingService");

const {
  updateSessionRecording,
  updateSession,
} = require("../services/sessionService");

async function createSession(req, res) {
  try {
    const { sessionId } = req.body || {};

    const session = createRecordingSession(sessionId);

    return res.status(201).json({
      success: true,
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error("Create recording session error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function uploadChunk(req, res) {
  try {
    const { sessionId } = req.params;

    const { chunkIndex } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    if (chunkIndex === undefined || chunkIndex === null) {
      return res.status(400).json({
        success: false,
        message: "Chunk index is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio chunk is required",
      });
    }

    const result = saveRecordingChunk(sessionId, Number(chunkIndex), req.file);

    updateSessionRecording(sessionId, {
      status: "recording",
    });

    updateSession(sessionId, {
      status: "recording",
    });

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Upload chunk error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function getSessionStatus(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const status = getRecordingSessionStatus(sessionId);

    return res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("Get session status error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function finalizeSession(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const result = await finalizeRecording(sessionId);

    updateSessionRecording(sessionId, {
      status: "completed",
      durationSeconds: result.durationSeconds || 0,
    });

    updateSession(sessionId, {
      status: "recorded",

      audio: {
        finalized: true,
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Finalize recording error:", error);

    if (error.code === "INCOMPLETE_CHUNK_SEQUENCE") {
      return res.status(409).json({
        success: false,
        message:
          "Recording cannot be finalized because some chunks are missing.",
        details: error.details,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

function getFinalRecordingFile(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const recording = getFinalRecording(sessionId);

    res.setHeader("Content-Type", "audio/webm");

    res.setHeader("Content-Length", String(recording.size));

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${recording.fileName}"`,
    );

    res.setHeader("Accept-Ranges", "bytes");

    return res.sendFile(recording.filePath);
  } catch (error) {
    console.error("Get final recording error:", error);

    if (error.code === "FINAL_RECORDING_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  createSession,
  uploadChunk,
  getSessionStatus,
  finalizeSession,
  getFinalRecordingFile,
};
