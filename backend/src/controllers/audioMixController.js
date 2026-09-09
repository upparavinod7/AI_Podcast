const {
  mixSessionAudio,
  getMixedRecording,
  getSessionTranscript,
} = require("../services/audioMixService");

const { updateSession } = require("../services/sessionService");

async function mixSession(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const result = await mixSessionAudio(sessionId, req.body);

    // Update main session after successful mixing
    updateSession(sessionId, {
      status: "completed",
      audio: {
        finalized: true,
        mixed: true,
      },
    });

    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:5000/api";

    return res.status(200).json({
      success: true,
      ...result,
      wavUrl: `${apiBaseUrl}/recording/sessions/${sessionId}/mix/wav`,
      mp3Url: `${apiBaseUrl}/recording/sessions/${sessionId}/mix/mp3`,
      downloadWavUrl: `${apiBaseUrl}/recording/sessions/${sessionId}/mix/wav?download=true`,
      downloadMp3Url: `${apiBaseUrl}/recording/sessions/${sessionId}/mix/mp3?download=true`,
    });
  } catch (error) {
    console.error("Session audio mix error:", error);

    const clientErrorCodes = [
      "INVALID_SESSION_ID",
      "FINAL_RECORDING_NOT_FOUND",
      "EMPTY_FINAL_RECORDING",
      "INVALID_TIMELINE",
      "INCOMPLETE_CUE",
      "INVALID_CUE_AUDIO_FILE",
      "INVALID_CUE_OFFSET",
      "CUE_AUDIO_NOT_FOUND",
      "OVERLAPPING_CUES",
    ];

    return res.status(clientErrorCodes.includes(error.code) ? 400 : 500).json({
      success: false,
      message: error.message || "Failed to mix session audio",
    });
  }
}

function getMixedAudio(req, res) {
  try {
    const { sessionId, format } = req.params;

    const recording = getMixedRecording(sessionId, format);

    res.setHeader("Content-Type", recording.contentType);

    res.setHeader("Content-Length", String(recording.size));

    const isDownload =
      req.query.download === "true" ||
      req.query.download === "1" ||
      req.path.endsWith("/download");

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${recording.fileName}"`,
      `${isDownload ? "attachment" : "inline"}; filename="${recording.fileName}"`,
    );

    res.setHeader("Accept-Ranges", "bytes");

    return res.sendFile(recording.filePath);
  } catch (error) {
    console.error("Get mixed audio error:", error);

    const status = error.code === "MIXED_RECORDING_NOT_FOUND" ? 404 : 400;

    return res.status(status).json({
      success: false,
      message: error.message || "Failed to load mixed audio",
    });
  }
}

function getTranscript(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const transcript = getSessionTranscript(sessionId);

    return res.status(200).json({
      success: true,
      sessionId,
      transcript,
    });
  } catch (error) {
    console.error("Get session transcript error:", error);

    const status = error.code === "TRANSCRIPT_NOT_FOUND" ? 404 : 400;

    return res.status(status).json({
      success: false,
      message: error.message || "Failed to load transcript",
    });
  }
}

module.exports = {
  mixSession,
  getMixedAudio,
  getTranscript,
};
