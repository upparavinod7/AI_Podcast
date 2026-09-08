const {
  mixSessionAudio,
  getMixedRecording,
} = require("../services/audioMixService");

async function mixSession(req, res) {
  try {
    const { sessionId } = req.params;
    const result = await mixSessionAudio(sessionId, req.body);
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:5000/api";

    return res.status(200).json({
      success: true,
      ...result,
      wavUrl: `${apiBaseUrl}/recording/sessions/${sessionId}/mix/wav`,
      mp3Url: `${apiBaseUrl}/recording/sessions/${sessionId}/mix/mp3`,
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
    res.setHeader("Content-Disposition", `inline; filename="${recording.fileName}"`);
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

module.exports = {
  mixSession,
  getMixedAudio,
};
