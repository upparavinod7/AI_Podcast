const STORAGE_PREFIX = "ai_podcast_session_timeline:";

export function createEmptyTimeline(sessionId) {
  return {
    sessionId,

    createdAt: new Date().toISOString(),

    recordingStartedAt: null,

    recordingStoppedAt: null,

    events: [],
  };
}

function getStorageKey(sessionId) {
  return `${STORAGE_PREFIX}${sessionId}`;
}

export function loadSessionTimeline(sessionId) {
  if (!sessionId) {
    return null;
  }

  try {
    const raw = localStorage.getItem(getStorageKey(sessionId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      parsed.sessionId !== sessionId ||
      !Array.isArray(parsed.events)
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to load session timeline:", error);

    return null;
  }
}

export function saveSessionTimeline(timeline) {
  if (!timeline || !timeline.sessionId) {
    throw new Error("Valid timeline is required");
  }

  try {
    localStorage.setItem(
      getStorageKey(timeline.sessionId),
      JSON.stringify(timeline),
    );

    return timeline;
  } catch (error) {
    console.error("Failed to save session timeline:", error);

    throw new Error("Could not save session timeline", { cause: error });
  }
}

export function startRecordingTimeline(sessionId) {
  const timeline =
    loadSessionTimeline(sessionId) || createEmptyTimeline(sessionId);

  timeline.recordingStartedAt = new Date().toISOString();

  timeline.recordingStoppedAt = null;

  timeline.events = [];

  saveSessionTimeline(timeline);

  return timeline;
}

export function stopRecordingTimeline(sessionId) {
  const timeline = loadSessionTimeline(sessionId);

  if (!timeline) {
    return null;
  }

  timeline.recordingStoppedAt = new Date().toISOString();

  saveSessionTimeline(timeline);

  return timeline;
}

export function addCueStartEvent(sessionId, cue) {
  const timeline =
    loadSessionTimeline(sessionId) || createEmptyTimeline(sessionId);

  const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const event = {
    eventId,

    cueIndex: cue.cueIndex,

    order: cue.order,

    speaker:
      cue.speaker ||
      (cue.voice === "leo" ? "Leo" : cue.voice === "maaya" ? "Maaya" : "Alex"),

    voice: cue.voice || "alex",

    text: cue.text,

    audioFile: cue.audioFile,

    audioUrl: cue.audioUrl,

    startOffsetMs: null,

    endOffsetMs: null,

    durationMs: cue.durationMs || 0,

    actualDurationMs: null,

    status: "playing",

    createdAt: new Date().toISOString(),
  };

  timeline.events.push(event);

  saveSessionTimeline(timeline);

  return event;
}

export function markCueStarted(sessionId, eventId, startOffsetMs) {
  const timeline = loadSessionTimeline(sessionId);

  if (!timeline) {
    return null;
  }

  const event = timeline.events.find((item) => item.eventId === eventId);

  if (!event) {
    return null;
  }

  event.startOffsetMs = Math.max(0, Math.round(startOffsetMs));

  event.status = "playing";

  saveSessionTimeline(timeline);

  return event;
}

export function markCueEnded(sessionId, eventId, endOffsetMs) {
  const timeline = loadSessionTimeline(sessionId);

  if (!timeline) {
    return null;
  }

  const event = timeline.events.find((item) => item.eventId === eventId);

  if (!event) {
    return null;
  }

  event.endOffsetMs = Math.max(0, Math.round(endOffsetMs));

  if (event.startOffsetMs !== null) {
    event.actualDurationMs = Math.max(
      0,
      event.endOffsetMs - event.startOffsetMs,
    );
  }

  event.status = "completed";

  saveSessionTimeline(timeline);

  return event;
}

export function markCueFailed(sessionId, eventId, reason) {
  const timeline = loadSessionTimeline(sessionId);

  if (!timeline) {
    return null;
  }

  const event = timeline.events.find((item) => item.eventId === eventId);

  if (!event) {
    return null;
  }

  event.status = "failed";

  event.error = reason || "AI cue playback failed";

  saveSessionTimeline(timeline);

  return event;
}

export function getTimelineEvents(sessionId) {
  const timeline = loadSessionTimeline(sessionId);

  if (!timeline) {
    return [];
  }

  return [...timeline.events];
}

export function clearSessionTimeline(sessionId) {
  if (!sessionId) {
    return;
  }

  localStorage.removeItem(getStorageKey(sessionId));
}
