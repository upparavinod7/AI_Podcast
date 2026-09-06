import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css"
import useChunkUploader from "./hooks/useChunkUploader";

import {
  createRecordingSession,
  getRecordingSessionStatus,
  generateCoHostTimeline,
  finalizeRecordingSession,
  mixPodcastSession,
  getFinalRecordingUrl,
} from "./services/recordingApi";

import {
  startRecordingTimeline,
  stopRecordingTimeline,
  loadSessionTimeline,
  addCueStartEvent,
  markCueStarted,
  markCueEnded,
  markCueFailed,
  getTimelineEvents,
  clearSessionTimeline,
} from "./utils/sessionTimeline";

// ============================================================
// CONSTANTS
// ============================================================

const ACTIVE_SESSION_KEY =
  "ai_podcast_active_session_id";

// ============================================================
// APP
// ============================================================

function App() {
  // ==========================================================
  // RECORDING STATE
  // ==========================================================

  const [sessionId, setSessionId] =
    useState(
      () =>
        localStorage.getItem(
          ACTIVE_SESSION_KEY
        ) || ""
    );

  const [isRecording, setIsRecording] =
    useState(false);

  const [isPaused, setIsPaused] =
    useState(false);

  const [audioUrl, setAudioUrl] =
    useState("");

  const [recordedBlob, setRecordedBlob] =
    useState(null);

  const [micReady, setMicReady] =
    useState(false);

  const [error, setError] =
    useState("");

  const [status, setStatus] =
    useState(null);

  const [hostRecording, setHostRecording] =
    useState(null);

  const [isFinalizing, setIsFinalizing] =
    useState(false);

  const [finalPodcast, setFinalPodcast] =
    useState(null);

  const [isMixing, setIsMixing] =
    useState(false);

  // ==========================================================
  // AI CO-HOST STATE
  // ==========================================================

  const [topic, setTopic] =
    useState(
      "Artificial Intelligence in Software Development"
    );

  const [outline, setOutline] =
    useState(
      "Discuss AI coding assistants, automation, impact on developers, software jobs, and the future of programming."
    );

  const [cueTimeline, setCueTimeline] =
    useState(null);

  const [isGeneratingCues, setIsGeneratingCues] =
    useState(false);

  const [currentCueIndex, setCurrentCueIndex] =
    useState(-1);

  const [isAiSpeaking, setIsAiSpeaking] =
    useState(false);

  const [aiError, setAiError] =
    useState("");

  // ==========================================================
  // SESSION EVENT TIMELINE
  // ==========================================================

  const [timelineEvents, setTimelineEvents] =
    useState([]);

  // ==========================================================
  // REFS
  // ==========================================================

  const chunksRef =
    useRef([]);

  const recorderRef =
    useRef(null);

  const chunkIndexRef =
    useRef(0);

  const streamRef =
    useRef(null);

  const aiAudioRef =
    useRef(null);

  // Monotonic browser clock.
  // This gives us accurate elapsed time
  // for the current recording page session.
  const recordingClockRef =
    useRef(null);

  // ==========================================================
  // CHUNK UPLOADER
  // ==========================================================

  const {
    queueChunk,
    retryFailedChunks,
    waitForUploads,

    pendingCount,
    failedCount,

    isUploading,
    lastError,
  } = useChunkUploader(
    sessionId
  );

  // ==========================================================
  // CLEANUP
  // ==========================================================

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(
          audioUrl
        );
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );
      }

      if (aiAudioRef.current) {
        aiAudioRef.current.pause();
        aiAudioRef.current =
          null;
      }
    };
  }, [audioUrl]);

  // ==========================================================
  // RESTORE SESSION
  // ==========================================================

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    localStorage.setItem(
      ACTIVE_SESSION_KEY,
      sessionId
    );

    loadBackendStatus(
      sessionId
    );

    const savedTimeline =
      loadSessionTimeline(
        sessionId
      );

    if (savedTimeline) {
      void Promise.resolve().then(() => {
        setTimelineEvents(
          savedTimeline.events || []
        );
      });
    } else {
      void Promise.resolve().then(() => {
        setTimelineEvents([]);
      });
    }
  // Status restoration is intentionally tied to session changes only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ==========================================================
  // LOAD BACKEND STATUS
  // ==========================================================

  async function loadBackendStatus(
    id = sessionId
  ) {
    if (!id) {
      return;
    }

    try {
      const result =
        await getRecordingSessionStatus(
          id
        );

      setStatus(result);
    } catch (error) {
      console.error(
        "Failed to get recording status:",
        error
      );
    }
  }

  // ==========================================================
  // CREATE SESSION
  // ==========================================================

  async function createNewSession() {
    try {
      setError("");

      const result =
        await createRecordingSession();

      const newSessionId =
        result.sessionId ||
        result.data?.sessionId;

      if (!newSessionId) {
        throw new Error(
          "Server did not return a session ID"
        );
      }

      localStorage.setItem(
        ACTIVE_SESSION_KEY,
        newSessionId
      );

      setSessionId(
        newSessionId
      );

      setStatus(result);

      chunkIndexRef.current = 0;
      chunksRef.current = [];

      clearSessionTimeline(
        newSessionId
      );

      setTimelineEvents([]);

      return newSessionId;

    } catch (error) {
      console.error(
        "Session creation failed:",
        error
      );

      setError(
        error.message
      );

      throw error;
    }
  }

  // ==========================================================
  // START RECORDING
  // ==========================================================

  async function startRecording() {
    try {
      setError("");
      setAiError("");

      let currentSessionId =
        sessionId;

      if (!currentSessionId) {
        currentSessionId =
          await createNewSession();
      }

      if (
        !navigator.mediaDevices
      ) {
        throw new Error(
          "Media devices are not supported by this browser."
        );
      }

      // Ask the browser to apply its built-in microphone
      // cleanup where supported.
      //
      // echoCancellation  -> reduces echo/feedback
      // noiseSuppression  -> reduces steady background noise
      // autoGainControl   -> keeps voice level more consistent
      //
      // mono input is sufficient for a spoken podcast and
      // reduces unnecessary recording data.
      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });

      streamRef.current =
        mediaStream;

      setMicReady(true);

      const supportedMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg",
      ];

      let selectedMimeType =
        "";

      for (
        const mimeType of
        supportedMimeTypes
      ) {
        if (
          MediaRecorder.isTypeSupported(
            mimeType
          )
        ) {
          selectedMimeType =
            mimeType;

          break;
        }
      }

      const recorderOptions =
        selectedMimeType
          ? {
              mimeType:
                selectedMimeType,
            }
          : undefined;

      const recorder =
        new MediaRecorder(
          mediaStream,
          recorderOptions
        );

      recorderRef.current =
        recorder;

      chunksRef.current = [];
      chunkIndexRef.current = 0;

      // --------------------------------------------------------
      // START THE SESSION CLOCK
      // --------------------------------------------------------

      recordingClockRef.current =
        performance.now();

      const timeline =
        startRecordingTimeline(
          currentSessionId
        );

      setTimelineEvents(
        timeline.events
      );

      // --------------------------------------------------------
      // DATA AVAILABLE
      // --------------------------------------------------------

      recorder.ondataavailable = async (event) => {
  if (
    !event.data ||
    event.data.size === 0
  ) {
    return;
  }

  const currentChunkIndex =
    chunkIndexRef.current;

  chunkIndexRef.current += 1;

  chunksRef.current.push(
    event.data
  );

  console.log(
    `Recording chunk ${currentChunkIndex} received:`,
    event.data.size,
    "bytes"
  );

  try {
    await queueChunk(
      currentChunkIndex,
      event.data
    );

    console.log(
      `Recording chunk ${currentChunkIndex} queued/uploaded.`
    );
  } catch (error) {
    console.error(
      "Failed to queue recording chunk:",
      error
    );

    setError(
      `Chunk ${currentChunkIndex} could not be saved locally.`
    );
  }
};

      recorder.onerror =
        (event) => {
          console.error(
            "MediaRecorder error:",
            event
          );

          setError(
            "Recording error occurred."
          );
        };

      recorder.onstop = async () => {
  try {
    /*
     * The final dataavailable event is fired before
     * MediaRecorder's stop event.
     *
     * waitForUploads() makes sure all chunks that were
     * saved to IndexedDB are uploaded before continuing.
     */
    await waitForUploads();

    /*
     * Build the local recording only after the final
     * MediaRecorder data has been collected.
     */
    const finalBlob = new Blob(
      chunksRef.current,
      {
        type:
          recorder.mimeType ||
          "audio/webm",
      }
    );

    if (audioUrl) {
      URL.revokeObjectURL(
        audioUrl
      );
    }

    const newAudioUrl =
      URL.createObjectURL(
        finalBlob
      );

    setRecordedBlob(
      finalBlob
    );

    setAudioUrl(
      newAudioUrl
    );

    /*
     * Refresh backend status after every chunk
     * has been uploaded.
     */
    await loadBackendStatus(
      currentSessionId
    );

    /*
     * Stop timeline recording only after
     * recording/upload is complete.
     */
    stopRecordingTimeline(
      currentSessionId
    );

    setTimelineEvents(
      getTimelineEvents(
        currentSessionId
      )
    );

    console.log(
      "Recording stopped successfully."
    );

    console.log(
      "Total local chunks:",
      chunksRef.current.length
    );
  } catch (error) {
    console.error(
      "Final upload wait failed:",
      error
    );

    setError(
      error.message ||
        "Failed to finish recording upload."
    );
  }
};

      // 5-second recording chunks
      recorder.start(5000);

      setIsRecording(true);
      setIsPaused(false);

      console.log(
        "Recording started:",
        recorder.mimeType
      );

    } catch (error) {
      console.error(
        "Failed to start recording:",
        error
      );

      recordingClockRef.current =
        null;

      setError(
        error.message
      );

      setIsRecording(false);
    }
  }

  // ==========================================================
  // PAUSE
  // ==========================================================

  function pauseRecording() {
    const recorder =
      recorderRef.current;

    if (
      !recorder ||
      recorder.state !==
        "recording"
    ) {
      return;
    }

    recorder.pause();

    setIsPaused(true);
  }

  // ==========================================================
  // RESUME
  // ==========================================================

  function resumeRecording() {
    const recorder =
      recorderRef.current;

    if (
      !recorder ||
      recorder.state !==
        "paused"
    ) {
      return;
    }

    recorder.resume();

    setIsPaused(false);
  }

  // ==========================================================
  // STOP
  // ==========================================================

  async function stopRecording() {
  const recorder =
    recorderRef.current;

  if (!recorder) {
    return;
  }

  /*
   * Calling stop() triggers the final dataavailable
   * event followed by onstop.
   *
   * Do NOT create the final Blob here because the
   * final dataavailable event may not have completed yet.
   */
  if (
    recorder.state === "recording" ||
    recorder.state === "paused"
  ) {
    recorder.stop();
  }

  setIsRecording(false);
  setIsPaused(false);

  /*
   * Stop microphone tracks.
   */
  if (streamRef.current) {
    streamRef.current
      .getTracks()
      .forEach((track) => {
        track.stop();
      });

    streamRef.current = null;
  }

  setMicReady(false);

  /*
   * onstop handles:
   * - waiting for uploads
   * - creating final Blob
   * - updating backend status
   * - stopping timeline
   */

  recordingClockRef.current = null;
}

 async function handleFinalizeRecording() {
  if (!sessionId || isRecording) {
    return;
  }

  try {
    setError("");
    setIsFinalizing(true);

    /*
     * Retry previously failed chunks first.
     */
    await retryFailedChunks();

    /*
     * Wait until the complete IndexedDB upload
     * queue has been processed.
     */
    await waitForUploads();

    /*
     * Get the latest backend status.
     */
    const latestStatus =
      await getRecordingSessionStatus(
        sessionId
      );

    setStatus(latestStatus);

    /*
     * Backend is the final source of truth.
     */
    if (
      latestStatus.missingChunks &&
      latestStatus.missingChunks.length > 0
    ) {
      throw new Error(
        `Cannot finalize: missing chunks ${latestStatus.missingChunks.join(", ")}.`
      );
    }

    /*
     * Finalize only after backend confirms
     * that the expected sequence is complete.
     */
    if (
      latestStatus.sequenceComplete === false
    ) {
      throw new Error(
        "Recording sequence is not complete yet. Please wait for all chunks to upload."
      );
    }

    const result =
      await finalizeRecordingSession(
        sessionId
      );

    setHostRecording({
      ...result,
      audioUrl:
        getFinalRecordingUrl(
          sessionId
        ),
    });

    console.log(
      "Host recording finalized successfully."
    );
  } catch (error) {
    console.error(
      "Host recording finalization failed:",
      error
    );

    setError(
      error.message ||
        "Failed to finalize host recording."
    );
  } finally {
    setIsFinalizing(false);
  }
}
  async function handleMixPodcast() {
    if (!sessionId || !hostRecording) {
      return;
    }

    try {
      setError("");
      setIsMixing(true);
      const result = await mixPodcastSession(
        sessionId,
        getTimelineEvents(sessionId)
      );
      setFinalPodcast(result);
    } catch (error) {
      console.error("Podcast mixing failed:", error);
      setError(error.message);
    } finally {
      setIsMixing(false);
    }
  }

  // ==========================================================
  // GENERATE AI CUES
  // ==========================================================

  async function handleGenerateCues() {
    try {
      setAiError("");

      setIsGeneratingCues(
        true
      );

      setCueTimeline(null);

      setCurrentCueIndex(
        -1
      );

      setIsAiSpeaking(
        false
      );

      if (
        aiAudioRef.current
      ) {
        aiAudioRef.current.pause();

        aiAudioRef.current =
          null;
      }

      const result =
        await generateCoHostTimeline(
          topic,
          outline
        );

      if (
        !result ||
        !Array.isArray(
          result.cues
        )
      ) {
        throw new Error(
          "Invalid AI cue response"
        );
      }

      setCueTimeline(
        result
      );

    } catch (error) {
      console.error(
        "AI cue generation failed:",
        error
      );

      setAiError(
        error.message
      );

    } finally {
      setIsGeneratingCues(
        false
      );
    }
  }

  // ==========================================================
  // NEXT AI CUE
  // ==========================================================

  async function handleNextCue() {
    if (
      !cueTimeline ||
      !Array.isArray(
        cueTimeline.cues
      ) ||
      cueTimeline.cues.length ===
        0
    ) {
      return;
    }

    if (isAiSpeaking) {
      return;
    }

    const nextIndex =
      currentCueIndex + 1;

    if (
      nextIndex >=
      cueTimeline.cues.length
    ) {
      setAiError(
        "All AI cues have been played."
      );

      return;
    }

    const cue =
      cueTimeline.cues[
        nextIndex
      ];

    if (
      cue.status !==
        "ready" ||
      !cue.audioUrl
    ) {
      setAiError(
        "Selected AI cue is not ready."
      );

      return;
    }

    setAiError("");

    setCurrentCueIndex(
      nextIndex
    );

    try {
      if (
        aiAudioRef.current
      ) {
        aiAudioRef.current.pause();

        aiAudioRef.current =
          null;
      }

      const audio =
        new Audio(
          cue.audioUrl
        );

      aiAudioRef.current =
        audio;

      // --------------------------------------------------------
      // Create event only if we are in a recording session.
      //
      // If recording is stopped, this is treated as
      // a preview and is NOT added to the mixing timeline.
      // --------------------------------------------------------

      const isRecordingSession =
        isRecording &&
        recordingClockRef.current !==
          null;

      let timelineEvent =
        null;

      if (isRecordingSession) {
        timelineEvent =
          addCueStartEvent(
            sessionId,
            cue
          );

        setTimelineEvents(
          getTimelineEvents(
            sessionId
          )
        );
      }

      audio.onplay = () => {
        setIsAiSpeaking(
          true
        );

        if (
          timelineEvent &&
          recordingClockRef.current !==
            null
        ) {
          const elapsedMs =
            performance.now() -
            recordingClockRef.current;

          markCueStarted(
            sessionId,
            timelineEvent.eventId,
            elapsedMs
          );

          setTimelineEvents(
            getTimelineEvents(
              sessionId
            )
          );

          console.log(
            `AI Cue ${
              cue.cueIndex + 1
            } started at ${Math.round(
              elapsedMs
            )} ms`
          );
        }
      };

      audio.onended = () => {
        setIsAiSpeaking(
          false
        );

        if (
          timelineEvent &&
          recordingClockRef.current !==
            null
        ) {
          const elapsedMs =
            performance.now() -
            recordingClockRef.current;

          markCueEnded(
            sessionId,
            timelineEvent.eventId,
            elapsedMs
          );

          setTimelineEvents(
            getTimelineEvents(
              sessionId
            )
          );

          console.log(
            `AI Cue ${
              cue.cueIndex + 1
            } ended at ${Math.round(
              elapsedMs
            )} ms`
          );
        }

        aiAudioRef.current =
          null;
      };

      audio.onerror = () => {
        setIsAiSpeaking(
          false
        );

        if (
          timelineEvent
        ) {
          markCueFailed(
            sessionId,
            timelineEvent.eventId,
            "Failed to play AI audio"
          );

          setTimelineEvents(
            getTimelineEvents(
              sessionId
            )
          );
        }

        aiAudioRef.current =
          null;

        setAiError(
          "Failed to play AI cue."
        );
      };

      await audio.play();

    } catch (error) {
      console.error(
        "AI cue playback failed:",
        error
      );

      setIsAiSpeaking(
        false
      );

      setAiError(
        "Browser could not start AI audio playback."
      );
    }
  }

  // ==========================================================
  // RETRY FAILED CHUNKS
  // ==========================================================

  async function handleRetry() {
    setError("");

    try {
      await retryFailedChunks();

      await loadBackendStatus(
        sessionId
      );
    } catch (error) {
      console.error(
        "Retry failed:",
        error
      );

      setError(
        error.message
      );
    }
  }

  // ==========================================================
  // DOWNLOAD LOCAL RECORDING
  // ==========================================================

  function downloadRecording() {
    if (
      !recordedBlob ||
      !audioUrl
    ) {
      return;
    }

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      audioUrl;

    anchor.download =
      `podcast-recording-${Date.now()}.webm`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();
  }

  // ==========================================================
  // NEW SESSION
  // ==========================================================

  function startNewSession() {
    if (isRecording) {
      return;
    }

    if (sessionId) {
      clearSessionTimeline(
        sessionId
      );
    }

    localStorage.removeItem(
      ACTIVE_SESSION_KEY
    );

    setSessionId("");
    setStatus(null);
    setHostRecording(null);
    setFinalPodcast(null);

    setAudioUrl("");
    setRecordedBlob(null);

    setError("");

    setCueTimeline(null);
    setCurrentCueIndex(-1);

    setIsAiSpeaking(false);
    setAiError("");

    setTimelineEvents([]);

    if (
      aiAudioRef.current
    ) {
      aiAudioRef.current.pause();

      aiAudioRef.current =
        null;
    }

    chunksRef.current = [];
    chunkIndexRef.current = 0;

    recordingClockRef.current =
      null;
  }

  // ==========================================================
  // UI VALUES
  // ==========================================================

  const totalBackendChunks =
    status?.receivedChunkCount ??
    0;

  const expectedBackendChunks =
    status?.expectedChunkCount ??
    null;

  const currentCue =
    cueTimeline &&
    cueTimeline.cues &&
    currentCueIndex >= 0
      ? cueTimeline.cues[
          currentCueIndex
        ]
      : null;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (  
    <div className="app-shell">
      <div className="app-container">

        {/* ================= HEADER ================= */}

        <header className="app-header">
          <div>
            <div className="brand-row">
              <div className="brand-icon">🎙</div>

              <div>
                <h1>AI Podcast Studio</h1>
                <p>
                  Create, record and produce podcasts with your AI co-host.
                </p>
              </div>
            </div>
          </div>

          <div className={`status-pill ${isRecording ? "recording" : ""}`}>
            <span className="status-dot"></span>
            {isRecording ? "Recording" : "Studio Ready"}
          </div>
        </header>

        {/* ================= ERROR ================= */}

        {(error || aiError) && (
          <div className="error-banner">
            <span>⚠</span>

            <div>
              {error && (
                <div>
                  <strong>Recording Error:</strong> {error}
                </div>
              )}

              {aiError && (
                <div>
                  <strong>AI Error:</strong> {aiError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SESSION ================= */}

        <section className="session-bar">
          <div>
            <span className="section-label">CURRENT SESSION</span>

            <div className="session-id">
              {sessionId || "No session created"}
            </div>
          </div>

          <div className="session-actions">
            {!sessionId && (
              <button
                className="btn btn-primary"
                onClick={createNewSession}
              >
                + Create Session
              </button>
            )}

            {sessionId && !isRecording && (
              <button
                className="btn btn-secondary"
                onClick={startNewSession}
              >
                New Session
              </button>
            )}
          </div>
        </section>

        {/* ================= MAIN GRID ================= */}

        <div className="studio-grid">

          {/* ================= HOST RECORDING ================= */}

          <section className="card recording-card">

            <div className="card-header">
              <div>
                <span className="card-eyebrow">RECORDING</span>
                <h2>Host Recording</h2>
              </div>

              <div className={`recording-icon ${isRecording ? "active" : ""}`}>
                {isRecording ? "●" : "🎙"}
              </div>
            </div>

            <div className="recording-display">

              <div className={`recording-state ${isRecording ? "live" : ""}`}>
                <span className="big-status-dot"></span>

                <div>
                  <strong>
                    {isRecording
                      ? isPaused
                        ? "Recording Paused"
                        : "Recording Live"
                      : "Ready to Record"}
                  </strong>

                  <small>
                    {micReady
                      ? "Microphone connected"
                      : "Microphone not active"}
                  </small>
                </div>
              </div>

              <div className="recording-time">
                {isRecording
                  ? isPaused
                    ? "PAUSED"
                    : "REC"
                  : "READY"}
              </div>
            </div>

            {/* RECORDING CONTROLS */}

            <div className="button-group">

              {!sessionId && (
                <button
                  className="btn btn-primary btn-large"
                  onClick={createNewSession}
                >
                  Create Session
                </button>
              )}

              {sessionId && !isRecording && (
                <button
                  className="btn btn-primary btn-large"
                  onClick={startRecording}
                >
                  ● Start Recording
                </button>
              )}

              {isRecording && !isPaused && (
                <button
                  className="btn btn-warning"
                  onClick={pauseRecording}
                >
                  ❚❚ Pause
                </button>
              )}

              {isRecording && isPaused && (
                <button
                  className="btn btn-primary"
                  onClick={resumeRecording}
                >
                  ▶ Resume
                </button>
              )}

              {isRecording && (
                <button
                  className="btn btn-danger"
                  onClick={stopRecording}
                >
                  ■ Stop
                </button>
              )}
            </div>

            {/* MIC STATUS */}

            <div className="info-grid">

              <div className="info-item">
                <span>Microphone</span>

                <strong className={micReady ? "success-text" : ""}>
                  {micReady ? "Ready / Active" : "Not Active"}
                </strong>
              </div>

              <div className="info-item">
                <span>Recorder</span>

                <strong>
                  {isRecording
                    ? isPaused
                      ? "Paused"
                      : "Recording"
                    : "Stopped"}
                </strong>
              </div>

            </div>

          </section>

          {/* ================= UPLOAD STATUS ================= */}

          <section className="card upload-card">

            <div className="card-header">
              <div>
                <span className="card-eyebrow">LIVE STATUS</span>
                <h2>Upload Status</h2>
              </div>

              <div className="upload-icon">☁</div>
            </div>

            <div className="upload-progress">

              <div className="progress-top">
                <span>Backend Upload</span>

                <strong>
                  {totalBackendChunks}
                  {expectedBackendChunks !== null
                    ? ` / ${expectedBackendChunks}`
                    : ""}
                </strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width:
                      expectedBackendChunks &&
                      expectedBackendChunks > 0
                        ? `${Math.min(
                            (totalBackendChunks /
                              expectedBackendChunks) *
                              100,
                            100
                          )}%`
                        : "0%",
                  }}
                />
              </div>

            </div>

            <div className="stats-grid">

              <div className="stat-box">
                <span>Pending</span>
                <strong>{pendingCount}</strong>
              </div>

              <div className="stat-box">
                <span>Failed</span>
                <strong className={failedCount > 0 ? "danger-text" : ""}>
                  {failedCount}
                </strong>
              </div>

              <div className="stat-box">
                <span>Worker</span>
                <strong className={isUploading ? "active-text" : ""}>
                  {isUploading ? "Uploading" : "Idle"}
                </strong>
              </div>

            </div>

            {failedCount > 0 && (
              <button
                className="btn btn-warning full-width"
                onClick={handleRetry}
                disabled={isUploading}
              >
                ↻ Retry Failed Chunks
              </button>
            )}

          </section>

        </div>

        {/* ================= FINALIZE ================= */}

        {sessionId && !isRecording && (
          <section className="card finalize-card">

            <div className="card-header">
              <div>
                <span className="card-eyebrow">STEP 02</span>
                <h2>Finalize Host Recording</h2>
              </div>

              <div className="step-number">02</div>
            </div>

            <p className="muted-text">
              Make sure all recording chunks are uploaded before creating
              the final host track.
            </p>

            <button
              className="btn btn-primary"
              onClick={handleFinalizeRecording}
              disabled={
                isFinalizing ||
                isUploading ||
                failedCount > 0 ||
                pendingCount > 0
              }
            >
              {isFinalizing
                ? "Finalizing Host Recording..."
                : "Finalize Host Recording"}
            </button>

            {hostRecording && (
              <div className="audio-result">

                <div className="result-header">
                  <div>
                    <span className="success-badge">✓ READY</span>

                    <h3>Host recording ready</h3>
                  </div>

                  <strong>
                    {Number(
                      hostRecording.durationSeconds || 0
                    ).toFixed(2)}{" "}
                    sec
                  </strong>
                </div>

                <audio
                  controls
                  src={hostRecording.audioUrl}
                />

              </div>
            )}

          </section>
        )}

        {/* ================= AI CO-HOST ================= */}

        <section className="card ai-card">

          <div className="ai-header">

            <div>
              <span className="card-eyebrow">AI CO-HOST</span>

              <h2>
                Plan your AI conversation
              </h2>

              <p>
                Give your AI co-host a topic and outline.
                It will generate questions you can play during recording.
              </p>
            </div>

            <div className="ai-orb">
              ✦
            </div>

          </div>

          <div className="form-grid">

            <div className="form-field">
              <label>Topic</label>

              <input
                value={topic}
                onChange={(event) =>
                  setTopic(event.target.value)
                }
                placeholder="e.g. Artificial Intelligence in Software Development"
              />
            </div>

            <div className="form-field">
              <label>Outline</label>

              <textarea
                value={outline}
                onChange={(event) =>
                  setOutline(event.target.value)
                }
                rows={5}
                placeholder="Discuss the main points, questions and ideas for the episode..."
              />
            </div>

          </div>

          <button
            className="btn btn-gradient btn-large"
            onClick={handleGenerateCues}
            disabled={isGeneratingCues}
          >
            {isGeneratingCues
              ? "✦ Generating AI Cues..."
              : "✦ Generate AI Cues"}
          </button>

        </section>

        {/* ================= AI CUE TIMELINE ================= */}

        {cueTimeline && (
          <section className="card cue-card">

            <div className="card-header">

              <div>
                <span className="card-eyebrow">AI CUE TIMELINE</span>

                <h2>AI Co-host Questions</h2>

                <p className="muted-text">
                  Play the generated cues while recording your episode.
                </p>
              </div>

              <div className="cue-count">
                <strong>
                  {cueTimeline.readyCueCount}
                </strong>

                <span>
                  / {cueTimeline.cueCount} ready
                </span>
              </div>

            </div>

            {/* CUES */}

            <div className="cue-list">

              {cueTimeline.cues.map((cue) => {

                const isCurrent =
                  cue.cueIndex === currentCueIndex;

                return (
                  <div
                    key={cue.cueIndex}
                    className={`cue-item ${
                      isCurrent ? "current" : ""
                    }`}
                  >

                    <div className="cue-number">
                      {String(cue.cueIndex + 1).padStart(2, "0")}
                    </div>

                    <div className="cue-content">

                      <div className="cue-top">

                        <span className="cue-label">
                          AI QUESTION
                        </span>

                        <span
                          className={`cue-status ${
                            cue.status === "ready"
                              ? "ready"
                              : ""
                          }`}
                        >
                          {cue.status}
                        </span>

                      </div>

                      <p>
                        {cue.text}
                      </p>

                      <div className="cue-meta">
                        <span>
                          ◷ {cue.durationSeconds} sec
                        </span>
                      </div>

                      {cue.audioUrl && (
                        <audio
                          controls
                          preload="metadata"
                          src={cue.audioUrl}
                        />
                      )}

                    </div>

                  </div>
                );
              })}

            </div>

            {/* AI SPEAKER */}

            <div
              className={`ai-speaking ${
                isAiSpeaking ? "speaking" : ""
              }`}
            >

              <div className="speaker-icon">
                {isAiSpeaking ? "🔊" : "✦"}
              </div>

              <div>
                <strong>
                  AI Co-host{" "}
                  {isAiSpeaking ? "is speaking" : "is ready"}
                </strong>

                <span>
                  {isAiSpeaking
                    ? "Playing the selected question..."
                    : "Ready for the next cue"}
                </span>
              </div>

              <div className="speaker-wave">
                <i></i>
                <i></i>
                <i></i>
                <i></i>
                <i></i>
              </div>

            </div>

            {/* CURRENT CUE */}

            {currentCue && (
              <div className="current-cue">

                <span className="card-eyebrow">
                  CURRENT CUE
                </span>

                <h3>
                  Cue {currentCue.cueIndex + 1}
                </h3>

                <p>
                  {currentCue.text}
                </p>

              </div>
            )}

            {/* NEXT BUTTON */}

            <button
              className="btn btn-gradient btn-large full-width"
              onClick={handleNextCue}
              disabled={
                isAiSpeaking ||
                currentCueIndex >=
                  cueTimeline.cues.length - 1
              }
            >
              {currentCueIndex >=
              cueTimeline.cues.length - 1
                ? "✓ All Cues Played"
                : "▶ Play Next AI Cue"}
            </button>

            {!isRecording && (
              <p className="preview-note">
                Preview mode — cues played while you are not recording
                will not be added to the session timeline.
              </p>
            )}

          </section>
        )}

        {/* ================= FINAL PODCAST ================= */}

        {hostRecording && (
          <section className="card final-card">

            <div className="final-hero">

              <div className="final-icon">
                ✨
              </div>

              <div>
                <span className="card-eyebrow">
                  FINAL PRODUCTION
                </span>

                <h2>
                  Create Final Podcast
                </h2>

                <p>
                  Mix your host recording with the AI co-host
                  cues at their recorded timestamps.
                </p>
              </div>

            </div>

            <button
              className="btn btn-gradient btn-large"
              onClick={handleMixPodcast}
              disabled={isMixing}
            >
              {isMixing
                ? "Creating Final Podcast..."
                : "✦ Create Final Podcast"}
            </button>

            {finalPodcast && (
              <div className="final-result">

                <div className="final-ready">

                  <div>
                    <span className="success-badge">
                      ✓ COMPLETE
                    </span>

                    <h3>
                      Your podcast is ready
                    </h3>
                  </div>

                  <strong>
                    {Number(
                      finalPodcast.wav?.durationSeconds || 0
                    ).toFixed(2)}{" "}
                    sec
                  </strong>

                </div>

                <audio
                  controls
                  src={finalPodcast.mp3Url}
                />

                <div className="download-row">

                  <a
                    href={finalPodcast.wavUrl}
                    download
                    className="download-btn"
                  >
                    ↓ Download WAV
                  </a>

                  <a
                    href={finalPodcast.mp3Url}
                    download
                    className="download-btn"
                  >
                    ↓ Download MP3
                  </a>

                </div>

              </div>
            )}

          </section>
        )}

        {/* ================= RECORDING TIMELINE ================= */}

        {timelineEvents.length > 0 && (
          <section className="card timeline-card">

            <div className="card-header">

              <div>
                <span className="card-eyebrow">
                  RECORDING TIMELINE
                </span>

                <h2>
                  AI Cue Events
                </h2>
              </div>

              <div className="timeline-count">
                {timelineEvents.length} events
              </div>

            </div>

            <div className="event-list">

              {timelineEvents.map((event) => (
                <div
                  key={event.eventId}
                  className="event-item"
                >

                  <div className="event-marker">
                    <span></span>
                  </div>

                  <div className="event-content">

                    <div className="event-header">

                      <strong>
                        AI Cue {event.cueIndex + 1}
                      </strong>

                      <span>
                        {event.status}
                      </span>

                    </div>

                    <p>
                      {event.text}
                    </p>

                    <div className="event-times">

                      <span>
                        Start:{" "}
                        {event.startOffsetMs !== null
                          ? `${(
                              event.startOffsetMs / 1000
                            ).toFixed(3)} sec`
                          : "—"}
                      </span>

                      <span>
                        End:{" "}
                        {event.endOffsetMs !== null
                          ? `${(
                              event.endOffsetMs / 1000
                            ).toFixed(3)} sec`
                          : "—"}
                      </span>

                      <span>
                        Duration:{" "}
                        {event.actualDurationMs !== null
                          ? `${(
                              event.actualDurationMs / 1000
                            ).toFixed(3)} sec`
                          : "—"}
                      </span>

                    </div>

                  </div>

                </div>
              ))}

            </div>

          </section>
        )}

        {/* ================= BACKEND SESSION ================= */}

        {status && (
          <section className="card backend-card">

            <div className="card-header">

              <div>
                <span className="card-eyebrow">
                  BACKEND
                </span>

                <h2>
                  Session Status
                </h2>
              </div>

              <div
                className={`backend-status ${
                  status.sequenceComplete
                    ? "complete"
                    : ""
                }`}
              >
                {status.sequenceComplete
                  ? "✓ Complete"
                  : "In Progress"}
              </div>

            </div>

            <div className="backend-grid">

              <div>
                <span>Sequence</span>

                <strong>
                  {status.sequenceComplete
                    ? "Complete"
                    : "Incomplete"}
                </strong>
              </div>

              <div>
                <span>Received Chunks</span>

                <strong>
                  {status.receivedChunkCount ?? 0}
                </strong>
              </div>

              <div>
                <span>Expected Chunks</span>

                <strong>
                  {status.expectedChunkCount ?? "—"}
                </strong>
              </div>

              <div>
                <span>Missing Chunks</span>

                <strong>
                  {status.missingChunks?.length ?? 0}
                </strong>
              </div>

            </div>

          </section>
        )}

        {/* ================= FOOTER ================= */}

        <footer className="app-footer">
          <span>AI Podcast Studio</span>
          <span>•</span>
          <span>Record → Generate → Mix → Publish</span>
        </footer>

      </div>
    </div>
  );
}

export default App;
