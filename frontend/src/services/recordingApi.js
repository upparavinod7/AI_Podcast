const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function handleResponse(response) {
  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Invalid server response (${response.status})`, {
      cause: error,
    });
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message ||
        data.error ||
        `Request failed with status ${response.status}`,
    );
  }

  return data;
}

export async function createRecordingSession() {
  const response = await fetch(`${API_BASE_URL}/recording/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return handleResponse(response);
}

export async function uploadRecordingChunk(sessionId, chunkIndex, blob) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  if (!Number.isInteger(chunkIndex)) {
    throw new Error("chunkIndex must be an integer");
  }

  if (!(blob instanceof Blob)) {
    throw new Error("audio blob is required");
  }

  const formData = new FormData();

  formData.append("chunkIndex", String(chunkIndex));

  const extension =
    blob.type === "audio/ogg"
      ? "ogg"
      : blob.type === "audio/mp4"
        ? "mp4"
        : "webm";

  formData.append(
    "audio",
    blob,
    `chunk-${String(chunkIndex).padStart(4, "0")}.${extension}`,
  );

  const response = await fetch(
    `${API_BASE_URL}/recording/sessions/${sessionId}/chunks`,
    {
      method: "POST",
      body: formData,
    },
  );

  return handleResponse(response);
}

export async function getRecordingSessionStatus(sessionId) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const response = await fetch(
    `${API_BASE_URL}/recording/sessions/${sessionId}/status`,
  );

  return handleResponse(response);
}

export async function finalizeRecordingSession(sessionId) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const response = await fetch(
    `${API_BASE_URL}/recording/sessions/${sessionId}/finalize`,
    { method: "POST" },
  );

  return handleResponse(response);
}

export async function mixPodcastSession(sessionId, events) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  if (!Array.isArray(events)) {
    throw new Error("timeline events are required");
  }

  const response = await fetch(
    `${API_BASE_URL}/recording/sessions/${sessionId}/mix`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeline: { events } }),
    },
  );

  return handleResponse(response);
}

export function getFinalRecordingUrl(sessionId) {
  return sessionId
    ? `${API_BASE_URL}/recording/sessions/${sessionId}/final`
    : "";
}

export async function generateCoHostTimeline(topic, outline, voice = "alex") {
  if (!topic || typeof topic !== "string") {
    throw new Error("Topic is required");
  }

  if (!outline || typeof outline !== "string") {
    throw new Error("Outline is required");
  }

  const response = await fetch(`${API_BASE_URL}/cohost/timeline`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      topic: topic.trim(),
      outline: outline.trim(),
      voice,
    }),
  });

  return handleResponse(response);
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function getPodcastTranscript(sessionId) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const response = await fetch(
    `${API_BASE_URL}/recording/sessions/${sessionId}/transcript`,
  );

  return handleResponse(response);
}

export function getMixedAudioUrl(sessionId, format = "mp3", download = false) {
  if (!sessionId) return "";
  const query = download ? "?download=true" : "";
  return `${API_BASE_URL}/recording/sessions/${sessionId}/mix/${format}${query}`;
}
