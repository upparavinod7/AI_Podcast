import {
  useEffect,
  useRef,
  useState,
} from "react";

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

      recorder.ondataavailable =
        async (event) => {
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

          try {
            await queueChunk(
              currentChunkIndex,
              event.data
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

      recorder.onstop =
        async () => {
          try {
            await waitForUploads();

            await loadBackendStatus(
              currentSessionId
            );

            stopRecordingTimeline(
              currentSessionId
            );

            setTimelineEvents(
              getTimelineEvents(
                currentSessionId
              )
            );
          } catch (error) {
            console.error(
              "Final upload wait failed:",
              error
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

    if (
      recorder.state ===
        "recording" ||
      recorder.state ===
        "paused"
    ) {
      recorder.stop();
    }

    setIsRecording(false);
    setIsPaused(false);

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );

      streamRef.current = null;
    }

    setMicReady(false);

    const finalBlob =
      new Blob(
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

    try {
      await waitForUploads();

      await loadBackendStatus(
        sessionId
      );
    } catch (error) {
      console.error(
        "Upload wait failed:",
        error
      );
    }

    recordingClockRef.current =
      null;
  }

  async function handleFinalizeRecording() {
    if (!sessionId || isRecording) {
      return;
    }

    try {
      setError("");
      setIsFinalizing(true);
      await retryFailedChunks();
      await waitForUploads();

      const latestStatus = await getRecordingSessionStatus(sessionId);
      setStatus(latestStatus);

      if (latestStatus.missingChunks?.length > 0) {
        throw new Error(`Cannot finalize: missing chunks ${latestStatus.missingChunks.join(", ")}.`);
      }

      if (failedCount > 0 || pendingCount > 0) {
        throw new Error("Wait for all recording chunks to upload before finalizing.");
      }

      const result = await finalizeRecordingSession(sessionId);
      setHostRecording({
        ...result,
        audioUrl: getFinalRecordingUrl(sessionId),
      });
    } catch (error) {
      console.error("Host recording finalization failed:", error);
      setError(error.message);
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
    <div
      style={{
        minHeight:
          "100vh",
        padding:
          "40px",
        fontFamily:
          "Arial, sans-serif",
        background:
          "#f5f5f5",
      }}
    >
      <div
        style={{
          maxWidth:
            "900px",
          margin:
            "0 auto",
          background:
            "#ffffff",
          padding:
            "30px",
          borderRadius:
            "16px",
          boxShadow:
            "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1>
          AI Podcast Studio
        </h1>

        <p>
          Browser recording +
          scripted AI co-host.
        </p>

        <hr />

        {/* ================================================== */}
        {/* HOST RECORDING */}
        {/* ================================================== */}

        <h2>
          Host Recording
        </h2>

        <p>
          <strong>
            Session ID:
          </strong>{" "}
          {sessionId ||
            "Not created"}
        </p>

        <div
          style={{
            display:
              "flex",
            gap:
              "10px",
            flexWrap:
              "wrap",
            marginBottom:
              "20px",
          }}
        >
          {!sessionId && (
            <button
              onClick={
                createNewSession
              }
            >
              Create Session
            </button>
          )}

          {sessionId &&
            !isRecording && (
              <button
                onClick={
                  startRecording
                }
              >
                Start Recording
              </button>
            )}

          {isRecording &&
            !isPaused && (
              <button
                onClick={
                  pauseRecording
                }
              >
                Pause
              </button>
            )}

          {isRecording &&
            isPaused && (
              <button
                onClick={
                  resumeRecording
                }
              >
                Resume
              </button>
            )}

          {isRecording && (
            <button
              onClick={
                stopRecording
              }
            >
              Stop
            </button>
          )}

          {!isRecording &&
            sessionId && (
              <button
                onClick={
                  startNewSession
                }
              >
                New Session
              </button>
            )}
        </div>

        <div
          style={{
            padding:
              "15px",
            borderRadius:
              "10px",
            background:
              "#f0f0f0",
            marginBottom:
              "20px",
          }}
        >
          <p>
            Microphone:{" "}
            <strong>
              {micReady
                ? "Ready / Active"
                : "Not active"}
            </strong>
          </p>

          <p>
            Recorder:{" "}
            <strong>
              {isRecording
                ? isPaused
                  ? "Paused"
                  : "Recording"
                : "Stopped"}
            </strong>
          </p>
        </div>

        {/* ================================================== */}
        {/* UPLOAD STATUS */}
        {/* ================================================== */}

        <div
          style={{
            padding:
              "15px",
            borderRadius:
              "10px",
            background:
              "#f8f8f8",
            marginBottom:
              "20px",
          }}
        >
          <h3>
            Upload Status
          </h3>

          <p>
            Backend uploaded:{" "}
            <strong>
              {totalBackendChunks}
            </strong>

            {expectedBackendChunks !==
            null
              ? ` / ${expectedBackendChunks}`
              : ""}
          </p>

          <p>
            Pending:{" "}
            <strong>
              {pendingCount}
            </strong>
          </p>

          <p>
            Failed:{" "}
            <strong>
              {failedCount}
            </strong>
          </p>

          <p>
            Upload worker:{" "}
            <strong>
              {isUploading
                ? "Uploading..."
                : "Idle"}
            </strong>
          </p>

          {failedCount >
            0 && (
            <button
              onClick={
                handleRetry
              }
              disabled={
                isUploading
              }
            >
              Retry Failed Chunks
            </button>
          )}
        </div>

        {sessionId && !isRecording && (
          <div style={{ padding: "15px", borderRadius: "10px", background: "#f8f8f8", marginBottom: "20px" }}>
            <h3>Finalize Host Recording</h3>
            <button
              onClick={handleFinalizeRecording}
              disabled={isFinalizing || isUploading || failedCount > 0 || pendingCount > 0}
            >
              {isFinalizing ? "Finalizing Host Recording..." : "Finalize Host Recording"}
            </button>
            {hostRecording && (
              <div style={{ marginTop: "15px" }}>
                <p><strong>Host recording ready.</strong> {Number(hostRecording.durationSeconds || 0).toFixed(2)} seconds</p>
                <audio controls src={hostRecording.audioUrl} style={{ width: "100%" }} />
              </div>
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* AI CO-HOST */}
        {/* ================================================== */}

        <hr />

        <h2>
          AI Co-host
        </h2>

        <label>
          <strong>
            Topic
          </strong>
        </label>

        <input
          value={topic}
          onChange={(event) =>
            setTopic(
              event.target.value
            )
          }
          style={{
            display:
              "block",
            width:
              "100%",
            boxSizing:
              "border-box",
            padding:
              "10px",
            marginTop:
              "6px",
            marginBottom:
              "15px",
          }}
        />

        <label>
          <strong>
            Outline
          </strong>
        </label>

        <textarea
          value={outline}
          onChange={(event) =>
            setOutline(
              event.target.value
            )
          }
          rows={5}
          style={{
            display:
              "block",
            width:
              "100%",
            boxSizing:
              "border-box",
            padding:
              "10px",
            marginTop:
              "6px",
            marginBottom:
              "15px",
            resize:
              "vertical",
          }}
        />

        <button
          onClick={
            handleGenerateCues
          }
          disabled={
            isGeneratingCues
          }
        >
          {isGeneratingCues
            ? "Generating AI Cues..."
            : "Generate AI Cues"}
        </button>

        {cueTimeline && (
          <div
            style={{
              marginTop:
                "20px",
              padding:
                "20px",
              borderRadius:
                "12px",
              background:
                "#f8f8f8",
            }}
          >
            <h3>
              AI Cue Timeline
            </h3>

            <p>
              Ready cues:{" "}
              <strong>
                {
                  cueTimeline.readyCueCount
                }
              </strong>{" "}
              /{" "}
              <strong>
                {
                  cueTimeline.cueCount
                }
              </strong>
            </p>

            <div
              style={{
                marginBottom:
                  "20px",
              }}
            >
              {cueTimeline.cues.map(
                (cue) => (
                  <div
                    key={
                      cue.cueIndex
                    }
                    style={{
                      padding:
                        "12px",
                      marginBottom:
                        "10px",
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "8px",
                      background:
                        cue.cueIndex ===
                        currentCueIndex
                          ? "#e9f5ff"
                          : "#ffffff",
                    }}
                  >
                    <strong>
                      Cue{" "}
                      {cue.cueIndex +
                        1}
                    </strong>

                    <p>
                      {
                        cue.text
                      }
                    </p>

                    <small>
                      Duration:{" "}
                      {
                        cue.durationSeconds
                      }{" "}
                      sec
                    </small>

                    <br />

                    <small>
                      Status:{" "}
                      {
                        cue.status
                      }
                    </small>

                    {cue.audioUrl && (
                      <audio
                        controls
                        preload="metadata"
                        src={cue.audioUrl}
                        style={{ display: "block", width: "100%", marginTop: "8px" }}
                      />
                    )}
                  </div>
                )
              )}
            </div>

            {/* ============================================== */}
            {/* AI SPEAKER INDICATOR */}
            {/* ============================================== */}

            <div
              style={{
                padding:
                  "15px",
                borderRadius:
                  "10px",
                background:
                  isAiSpeaking
                    ? "#fff3cd"
                    : "#eeeeee",
                marginBottom:
                  "15px",
              }}
            >
              <strong>
                AI Co-host:{" "}
                {isAiSpeaking
                  ? "SPEAKING 🔊"
                  : "READY"}
              </strong>
            </div>

            {currentCue && (
              <div
                style={{
                  marginBottom:
                    "15px",
                }}
              >
                <strong>
                  Current Cue:
                </strong>{" "}
                {currentCue
                  .cueIndex +
                  1}

                <p>
                  {
                    currentCue.text
                  }
                </p>
              </div>
            )}

            <button
              onClick={
                handleNextCue
              }
              disabled={
                isAiSpeaking ||
                currentCueIndex >=
                  cueTimeline.cues.length -
                    1
              }
            >
              {currentCueIndex >=
              cueTimeline.cues.length -
                1
                ? "All Cues Played"
                : "Next AI Cue 🔊"}
            </button>

            {!isRecording && (
              <p
                style={{
                  marginTop:
                    "10px",
                  fontSize:
                    "14px",
                  color:
                    "#666",
                }}
              >
                AI cue preview mode:
                cues played while not
                recording are not added
                to the session timeline.
              </p>
            )}
          </div>
        )}

        {hostRecording && (
          <div style={{ marginTop: "24px", padding: "20px", borderRadius: "12px", background: "#eef8f1" }}>
            <h2>Final Podcast</h2>
            <p>Mix the finalized host track with completed AI cues at their recorded timestamps.</p>
            <button onClick={handleMixPodcast} disabled={isMixing} style={{ marginTop: "12px" }}>
              {isMixing ? "Creating Final Podcast..." : "Create Final Podcast"}
            </button>
            {finalPodcast && (
              <div style={{ marginTop: "16px" }}>
                <p><strong>Final podcast ready.</strong> {Number(finalPodcast.wav?.durationSeconds || 0).toFixed(2)} seconds</p>
                <audio controls src={finalPodcast.mp3Url} style={{ width: "100%" }} />
                <p style={{ marginTop: "12px" }}>
                  <a href={finalPodcast.wavUrl} download>Download WAV master</a>{" · "}
                  <a href={finalPodcast.mp3Url} download>Download MP3</a>
                </p>
              </div>
            )}
          </div>
        )}

        {aiError && (
          <div
            style={{
              marginTop:
                "15px",
              padding:
                "12px",
              borderRadius:
                "8px",
              background:
                "#ffe5e5",
            }}
          >
            <strong>
              AI Error:
            </strong>{" "}
            {aiError}
          </div>
        )}

        {/* ================================================== */}
        {/* SESSION TIMELINE */}
        {/* ================================================== */}

        {timelineEvents.length >
          0 && (
          <div
            style={{
              marginTop:
                "20px",
              padding:
                "20px",
              borderRadius:
                "12px",
              background:
                "#f8f8f8",
            }}
          >
            <h3>
              Recording Event Timeline
            </h3>

            <p>
              AI cues recorded in
              this session:{" "}
              <strong>
                {
                  timelineEvents.length
                }
              </strong>
            </p>

            {timelineEvents.map(
              (event) => (
                <div
                  key={
                    event.eventId
                  }
                  style={{
                    padding:
                      "12px",
                    marginBottom:
                      "10px",
                    border:
                      "1px solid #ddd",
                    borderRadius:
                      "8px",
                    background:
                      "#ffffff",
                  }}
                >
                  <strong>
                    AI Cue{" "}
                    {event.cueIndex +
                      1}
                  </strong>

                  <p>
                    {
                      event.text
                    }
                  </p>

                  <small>
                    Status:{" "}
                    {
                      event.status
                    }
                  </small>

                  <br />

                  <small>
                    Start:{" "}
                    {event.startOffsetMs !==
                    null
                      ? `${(
                          event.startOffsetMs /
                          1000
                        ).toFixed(
                          3
                        )} sec`
                      : "—"}
                  </small>

                  <br />

                  <small>
                    End:{" "}
                    {event.endOffsetMs !==
                    null
                      ? `${(
                          event.endOffsetMs /
                          1000
                        ).toFixed(
                          3
                        )} sec`
                      : "—"}
                  </small>

                  <br />

                  <small>
                    Duration:{" "}
                    {event.actualDurationMs !==
                    null
                      ? `${(
                          event.actualDurationMs /
                          1000
                        ).toFixed(
                          3
                        )} sec`
                      : "—"}
                  </small>
                </div>
              )
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* BACKEND SESSION */}
        {/* ================================================== */}

        {status && (
          <div
            style={{
              marginTop:
                "20px",
              padding:
                "15px",
              borderRadius:
                "10px",
              background:
                "#f8f8f8",
            }}
          >
            <h3>
              Backend Session
            </h3>

            <p>
              Sequence complete:{" "}
              <strong>
                {status.sequenceComplete
                  ? "Yes"
                  : "No"}
              </strong>
            </p>

            <p>
              Received:{" "}
              <strong>
                {
                  status.receivedChunkCount
                }
              </strong>
            </p>

            <p>
              Expected:{" "}
              <strong>
                {
                  status.expectedChunkCount
                }
              </strong>
            </p>
          </div>
        )}

        {/* ================================================== */}
        {/* ERRORS */}
        {/* ================================================== */}

        {(error ||
          lastError) && (
          <div
            style={{
              marginTop:
                "20px",
              padding:
                "15px",
              borderRadius:
                "10px",
              background:
                "#ffe5e5",
            }}
          >
            <strong>
              Recording Error:
            </strong>{" "}
            {error ||
              lastError}
          </div>
        )}

        {/* ================================================== */}
        {/* LOCAL PREVIEW */}
        {/* ================================================== */}

        {audioUrl && (
          <div
            style={{
              marginTop:
                "20px",
            }}
          >
            <h3>
              Local Host Recording
            </h3>

            <audio
              controls
              src={audioUrl}
              style={{
                width:
                  "100%",
              }}
            />

            <br />
            <br />

            <button
              onClick={
                downloadRecording
              }
            >
              Download Recording
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
