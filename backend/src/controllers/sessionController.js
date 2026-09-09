const crypto = require("crypto");

const {
  saveSession,
  getSession,
  getAllSessions,
  updateSession,
  deleteSession,
} = require("../services/sessionService");

const {
  createRecordingSession,
  getRecordingSessionStatus,
} = require("../services/recordingService");

function createSession(req, res) {
  try {
    const sessionId = crypto.randomUUID();

    const now = new Date().toISOString();

    const session = {
      sessionId,
      title: "Untitled Podcast",
      description: "",
      status: "created",
      createdAt: now,
      updatedAt: now,
      recording: {
        status: "not_started",
        durationSeconds: 0,
      },
      ai: {
        cueCount: 0,
      },
      audio: {
        finalized: false,
        mixed: false,
      },
    };

    saveSession(session);
    createRecordingSession(sessionId);

    return res.status(201).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Create session error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create session",
    });
  }
}

function getSessionDetails(req, res) {
  try {
    const { sessionId } = req.params;

    const session = getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    let recordingStatus = null;

    try {
      recordingStatus = getRecordingSessionStatus(sessionId);
    } catch {
      recordingStatus = null;
    }

    return res.status(200).json({
      success: true,
      session,
      recordingStatus,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

function listSessions(req, res) {
  try {
    const sessions = getAllSessions();

    return res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

function updateSessionDetails(req, res) {
  try {
    const { sessionId } = req.params;

    const { title, description } = req.body;

    const existing = getSession(sessionId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    const updates = {};

    if (typeof title === "string") {
      updates.title = title.trim() || "Untitled Podcast";
    }

    if (typeof description === "string") {
      updates.description = description.trim();
    }

    const session = updateSession(sessionId, updates);

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

function removeSession(req, res) {
  try {
    const { sessionId } = req.params;

    const deleted = deleteSession(sessionId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Session deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  createSession,
  getSessionDetails,
  listSessions,
  updateSessionDetails,
  removeSession,
};
