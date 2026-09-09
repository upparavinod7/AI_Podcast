const fs = require("fs");
const path = require("path");

const SESSIONS_ROOT = path.resolve(__dirname, "../../outputs/sessions");

function ensureSessionsDirectory() {
  fs.mkdirSync(SESSIONS_ROOT, {
    recursive: true,
  });
}

function getSessionFile(sessionId) {
  return path.join(SESSIONS_ROOT, `${sessionId}.json`);
}

function saveSession(session) {
  ensureSessionsDirectory();

  const filePath = getSessionFile(session.sessionId);

  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), "utf8");

  return session;
}

function getSession(sessionId) {
  const filePath = getSessionFile(sessionId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function updateSession(sessionId, updates) {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  const updatedSession = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return saveSession(updatedSession);
}

function getAllSessions() {
  ensureSessionsDirectory();

  const files = fs
    .readdirSync(SESSIONS_ROOT)
    .filter((file) => file.endsWith(".json"));

  return files
    .map((file) => {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(SESSIONS_ROOT, file), "utf8"),
        );
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt),
    );
}

function deleteSession(sessionId) {
  const filePath = getSessionFile(sessionId);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);

  return true;
}
function updateSessionRecording(sessionId, recordingUpdates) {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  const updatedSession = {
    ...session,

    recording: {
      ...(session.recording || {}),
      ...recordingUpdates,
    },

    updatedAt: new Date().toISOString(),
  };

  return saveSession(updatedSession);
}

module.exports = {
  saveSession,
  getSession,
  updateSession,
  updateSessionRecording,
  getAllSessions,
  deleteSession,
};
