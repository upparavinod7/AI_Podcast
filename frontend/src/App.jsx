import { useEffect, useRef, useState } from "react";

import "./App.css";
import useChunkUploader from "./hooks/useChunkUploader";
import VoiceGenerator from "./components/VoiceGenerator";
import {
  VOICES,
  generateSpeech,
  getTtsAudioUrl,
  normalizeVoice,
  getSpeakerName,
  getVoiceDisplayName,
} from "./services/ttsApi";

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

const ACTIVE_SESSION_KEY = "ai_podcast_active_session_id";

function App() {
  const [sessionId, setSessionId] = useState(
    () => localStorage.getItem(ACTIVE_SESSION_KEY) || "",
  );

  const [isRecording, setIsRecording] = useState(false);

  const [isPaused, setIsPaused] = useState(false);

  const [audioUrl, setAudioUrl] = useState("");

  const [recordedBlob, setRecordedBlob] = useState(null);

  const [micReady, setMicReady] = useState(false);

  const [error, setError] = useState("");

  const [status, setStatus] = useState(null);

  const [hostRecording, setHostRecording] = useState(null);

  const [isFinalizing, setIsFinalizing] = useState(false);

  const [finalPodcast, setFinalPodcast] = useState(null);

  const [isMixing, setIsMixing] = useState(false);

  const [topic, setTopic] = useState(
    "Artificial Intelligence in Software Development",
  );

  const [outline, setOutline] = useState(
    "Discuss AI coding assistants, automation, impact on developers, software jobs, and the future of programming.",
  );

  const [cueTimeline, setCueTimeline] = useState(null);

  const [selectedVoice, setSelectedVoice] = useState("alex");

  const [isGeneratingCues, setIsGeneratingCues] = useState(false);

  const [currentCueIndex, setCurrentCueIndex] = useState(-1);

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const [aiError, setAiError] = useState("");

  const [timelineEvents, setTimelineEvents] = useState([]);

  const chunksRef = useRef([]);

  const recorderRef = useRef(null);

  const chunkIndexRef = useRef(0);

  const streamRef = useRef(null);

  const aiAudioRef = useRef(null);

  const recordingClockRef = useRef(null);

  const {
    queueChunk,
    retryFailedChunks,
    waitForUploads,

    pendingCount,
    failedCount,

    isUploading,
  } = useChunkUploader(sessionId);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (aiAudioRef.current) {
        aiAudioRef.current.pause();
        aiAudioRef.current = null;
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);

    loadBackendStatus(sessionId);

    const savedTimeline = loadSessionTimeline(sessionId);

    if (savedTimeline) {
      void Promise.resolve().then(() => {
        setTimelineEvents(savedTimeline.events || []);
      });
    } else {
      void Promise.resolve().then(() => {
        setTimelineEvents([]);
      });
    }
  }, [sessionId]);

  async function loadBackendStatus(id = sessionId) {
    if (!id) {
      return;
    }

    try {
      const result = await getRecordingSessionStatus(id);

      setStatus(result);
    } catch (error) {
      console.error("Failed to get recording status:", error);
    }
  }

  async function createNewSession() {
    try {
      setError("");

      const result = await createRecordingSession();

      const newSessionId = result.sessionId || result.data?.sessionId;

      if (!newSessionId) {
        throw new Error("Server did not return a session ID");
      }

      localStorage.setItem(ACTIVE_SESSION_KEY, newSessionId);

      setSessionId(newSessionId);

      setStatus(result);

      chunkIndexRef.current = 0;
      chunksRef.current = [];

      clearSessionTimeline(newSessionId);

      setTimelineEvents([]);

      return newSessionId;
    } catch (error) {
      console.error("Session creation failed:", error);

      setError(error.message);

      throw error;
    }
  }

  async function startRecording() {
    try {
      setError("");
      setAiError("");

      let currentSessionId = sessionId;

      if (!currentSessionId) {
        currentSessionId = await createNewSession();
      }

      if (!navigator.mediaDevices) {
        throw new Error("Media devices are not supported by this browser.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      const supportedMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg",
      ];

      let selectedMimeType = "";

      for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;

          break;
        }
      }

      const recorderOptions = selectedMimeType
        ? {
            mimeType: selectedMimeType,
          }
        : undefined;

      const recorder = new MediaRecorder(mediaStream, recorderOptions);

      recorderRef.current = recorder;

      chunksRef.current = [];
      chunkIndexRef.current = 0;

      recordingClockRef.current = performance.now();

      const timeline = startRecordingTimeline(currentSessionId);

      setTimelineEvents(timeline.events);

      recorder.ondataavailable = async (event) => {
        if (!event.data || event.data.size === 0) {
          return;
        }

        const currentChunkIndex = chunkIndexRef.current;

        chunkIndexRef.current += 1;

        chunksRef.current.push(event.data);

        console.log(
          `Recording chunk ${currentChunkIndex} received:`,
          event.data.size,
          "bytes",
        );

        try {
          await queueChunk(currentChunkIndex, event.data);

          console.log(`Recording chunk ${currentChunkIndex} queued/uploaded.`);
        } catch (error) {
          console.error("Failed to queue recording chunk:", error);

          setError(`Chunk ${currentChunkIndex} could not be saved locally.`);
        }
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);

        setError("Recording error occurred.");
      };

      recorder.onstop = async () => {
        try {
          await waitForUploads();

          const finalBlob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }

          const newAudioUrl = URL.createObjectURL(finalBlob);

          setRecordedBlob(finalBlob);

          setAudioUrl(newAudioUrl);

          await loadBackendStatus(currentSessionId);

          stopRecordingTimeline(currentSessionId);

          setTimelineEvents(getTimelineEvents(currentSessionId));

          console.log("Recording stopped successfully.");

          console.log("Total local chunks:", chunksRef.current.length);
        } catch (error) {
          console.error("Final upload wait failed:", error);

          setError(error.message || "Failed to finish recording upload.");
        }
      };

      recorder.start(5000);

      setIsRecording(true);
      setIsPaused(false);

      console.log("Recording started:", recorder.mimeType);
    } catch (error) {
      console.error("Failed to start recording:", error);

      recordingClockRef.current = null;

      setError(error.message);

      setIsRecording(false);
    }
  }

  function pauseRecording() {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state !== "recording") {
      return;
    }

    recorder.pause();

    setIsPaused(true);
  }

  // RESUME
  function resumeRecording() {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state !== "paused") {
      return;
    }

    recorder.resume();

    setIsPaused(false);
  }

  async function stopRecording() {
    const recorder = recorderRef.current;

    if (!recorder) {
      return;
    }

    if (recorder.state === "recording" || recorder.state === "paused") {
      recorder.stop();
    }

    setIsRecording(false);
    setIsPaused(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    setMicReady(false);

    recordingClockRef.current = null;
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

      if (latestStatus.missingChunks && latestStatus.missingChunks.length > 0) {
        throw new Error(
          `Cannot finalize: missing chunks ${latestStatus.missingChunks.join(", ")}.`,
        );
      }

      if (latestStatus.sequenceComplete === false) {
        throw new Error(
          "Recording sequence is not complete yet. Please wait for all chunks to upload.",
        );
      }

      const result = await finalizeRecordingSession(sessionId);

      setHostRecording({
        ...result,
        audioUrl: getFinalRecordingUrl(sessionId),
      });

      console.log("Host recording finalized successfully.");
    } catch (error) {
      console.error("Host recording finalization failed:", error);

      setError(error.message || "Failed to finalize host recording.");
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
        getTimelineEvents(sessionId),
      );
      setFinalPodcast(result);
    } catch (error) {
      console.error("Podcast mixing failed:", error);
      setError(error.message);
    } finally {
      setIsMixing(false);
    }
  }

  async function handleGenerateCues() {
    try {
      setAiError("");

      setIsGeneratingCues(true);

      setCueTimeline(null);

      setCurrentCueIndex(-1);

      setIsAiSpeaking(false);

      if (aiAudioRef.current) {
        aiAudioRef.current.pause();

        aiAudioRef.current = null;
      }

      const activeVoice = normalizeVoice(selectedVoice);
      const result = await generateCoHostTimeline(topic, outline, activeVoice);

      if (!result || !Array.isArray(result.cues)) {
        throw new Error("Invalid AI cue response");
      }

      const initialCues = result.cues.map((item, index) => {
        const cueVoice = normalizeVoice(item.voice || activeVoice);
        const cueSpeaker = item.speaker || getSpeakerName(cueVoice);
        return {
          id: item.id || `cue-${index + 1}`,
          cueIndex: index,
          order: item.order || index + 1,
          speaker: cueSpeaker,
          voice: cueVoice,
          text: item.text || item.question || "",
          audioFile: item.audioFile || null,
          audioUrl: item.audioUrl || null,
          durationMs: item.durationMs || 0,
          durationSeconds: item.durationSeconds || 0,
          triggerMode: item.triggerMode || "manual_next",
          status: item.audioUrl ? "ready" : "generating",
        };
      });

      setCueTimeline({
        ...result,
        cues: initialCues,
      });

      for (const cue of initialCues) {
        if (!cue.audioUrl) {
          setCueTimeline((prev) => {
            if (!prev || !Array.isArray(prev.cues)) return prev;
            return {
              ...prev,
              cues: prev.cues.map((item) =>
                item.id === cue.id
                  ? { ...item, status: "generating", error: null }
                  : item,
              ),
            };
          });

          const voice = cue.voice;
          console.log(
            "[TTS] Generating cue:",
            cue.id,
            "speaker:",
            cue.speaker,
            "voice:",
            voice,
          );

          try {
            const result = await generateSpeech(cue.text, voice);
            const audioUrl = getTtsAudioUrl(result.audio.fileName);

            setCueTimeline((prev) => {
              if (!prev || !Array.isArray(prev.cues)) return prev;
              const updatedCues = prev.cues.map((c) =>
                c.id === cue.id
                  ? {
                      ...c,
                      status: "ready",
                      audioFile: result.audio.fileName,
                      audioUrl,
                      durationMs: result.audio.durationMs,
                      durationSeconds: Number(
                        (result.audio.durationMs / 1000).toFixed(3),
                      ),
                      error: null,
                    }
                  : c,
              );
              return {
                ...prev,
                cues: updatedCues,
                readyCueCount: updatedCues.filter((c) => c.status === "ready")
                  .length,
              };
            });
          } catch (cueErr) {
            console.error(`[TTS] Failed to generate cue ${cue.id}:`, cueErr);
            const errorMessage = cueErr.message || "Failed to generate speech";
            setCueTimeline((prev) => {
              if (!prev || !Array.isArray(prev.cues)) return prev;
              const updatedCues = prev.cues.map((c) =>
                c.id === cue.id
                  ? {
                      ...c,
                      status: "error",
                      error: errorMessage,
                    }
                  : c,
              );
              return {
                ...prev,
                cues: updatedCues,
                readyCueCount: updatedCues.filter((c) => c.status === "ready")
                  .length,
              };
            });
          }
        }
      }
    } catch (error) {
      console.error("AI cue generation failed:", error);

      setAiError(error.message);
    } finally {
      setIsGeneratingCues(false);
    }
  }

  function handleCueVoiceChange(cueId, newVoice) {
    const normalized = normalizeVoice(newVoice);
    setCueTimeline((prev) => {
      if (!prev || !Array.isArray(prev.cues)) return prev;
      const updatedCues = prev.cues.map((c) => {
        if (c.id !== cueId) return c;
        if (c.voice === normalized) return c;
        return {
          ...c,
          voice: normalized,
          speaker: getSpeakerName(normalized),
          audioFile: null,
          audioUrl: null,
          durationMs: 0,
          durationSeconds: 0,
          status: "idle",
          error: null,
        };
      });
      return {
        ...prev,
        cues: updatedCues,
        readyCueCount: updatedCues.filter((c) => c.status === "ready").length,
      };
    });
  }

  async function handleGenerateSingleCue(cueId) {
    const cue = cueTimeline?.cues?.find((c) => c.id === cueId);
    if (!cue || cue.status === "generating") return;

    try {
      setAiError("");

      setCueTimeline((prev) => {
        if (!prev || !Array.isArray(prev.cues)) return prev;
        return {
          ...prev,
          cues: prev.cues.map((c) =>
            c.id === cueId ? { ...c, status: "generating", error: null } : c,
          ),
        };
      });

      const voice = cue.voice;
      console.log(
        "[TTS] Generating cue:",
        cue.id,
        "speaker:",
        cue.speaker,
        "voice:",
        voice,
      );

      const result = await generateSpeech(cue.text, voice);
      const audioUrl = getTtsAudioUrl(result.audio.fileName);

      setCueTimeline((prev) => {
        if (!prev || !Array.isArray(prev.cues)) return prev;
        const updatedCues = prev.cues.map((c) =>
          c.id === cueId
            ? {
                ...c,
                status: "ready",
                audioFile: result.audio.fileName,
                audioUrl,
                durationMs: result.audio.durationMs,
                durationSeconds: Number(
                  (result.audio.durationMs / 1000).toFixed(3),
                ),
                error: null,
              }
            : c,
        );
        return {
          ...prev,
          cues: updatedCues,
          readyCueCount: updatedCues.filter((c) => c.status === "ready").length,
        };
      });
    } catch (error) {
      console.error("Single cue generation failed:", error);
      const errorMessage =
        error.message ||
        `Failed to generate speech for ${cue.speaker || cue.voice}`;
      setCueTimeline((prev) => {
        if (!prev || !Array.isArray(prev.cues)) return prev;
        const updatedCues = prev.cues.map((c) =>
          c.id === cueId ? { ...c, status: "error", error: errorMessage } : c,
        );
        return {
          ...prev,
          cues: updatedCues,
          readyCueCount: updatedCues.filter((c) => c.status === "ready").length,
        };
      });
    }
  }

  async function handleRegenerateAllCues() {
    if (!cueTimeline || !Array.isArray(cueTimeline.cues)) return;

    try {
      setAiError("");
      setIsGeneratingCues(true);

      for (const cue of cueTimeline.cues) {
        setCueTimeline((prev) => {
          if (!prev || !Array.isArray(prev.cues)) return prev;
          return {
            ...prev,
            cues: prev.cues.map((item) =>
              item.id === cue.id
                ? { ...item, status: "generating", error: null }
                : item,
            ),
          };
        });

        const voice = cue.voice;
        console.log(
          "[TTS] Generating cue:",
          cue.id,
          "speaker:",
          cue.speaker,
          "voice:",
          voice,
        );

        try {
          const result = await generateSpeech(cue.text, voice);
          const audioUrl = getTtsAudioUrl(result.audio.fileName);

          setCueTimeline((prev) => {
            if (!prev || !Array.isArray(prev.cues)) return prev;
            const updatedCues = prev.cues.map((c) =>
              c.id === cue.id
                ? {
                    ...c,
                    status: "ready",
                    audioFile: result.audio.fileName,
                    audioUrl,
                    durationMs: result.audio.durationMs,
                    durationSeconds: Number(
                      (result.audio.durationMs / 1000).toFixed(3),
                    ),
                    error: null,
                  }
                : c,
            );
            return {
              ...prev,
              cues: updatedCues,
              readyCueCount: updatedCues.filter((c) => c.status === "ready")
                .length,
            };
          });
        } catch (cueErr) {
          console.error(`[TTS] Failed to generate cue ${cue.id}:`, cueErr);
          const errorMessage = cueErr.message || "Failed to generate speech";
          setCueTimeline((prev) => {
            if (!prev || !Array.isArray(prev.cues)) return prev;
            const updatedCues = prev.cues.map((c) =>
              c.id === cue.id
                ? {
                    ...c,
                    status: "error",
                    error: errorMessage,
                  }
                : c,
            );
            return {
              ...prev,
              cues: updatedCues,
              readyCueCount: updatedCues.filter((c) => c.status === "ready")
                .length,
            };
          });
        }
      }
    } catch (error) {
      console.error("Regenerate all cues failed:", error);
      setAiError(error.message || "Failed to regenerate cues");
    } finally {
      setIsGeneratingCues(false);
    }
  }

  async function handleLoadSampleCues() {
    try {
      setAiError("");
      setIsGeneratingCues(true);
      setCurrentCueIndex(-1);
      setIsAiSpeaking(false);
      if (aiAudioRef.current) {
        aiAudioRef.current.pause();
        aiAudioRef.current = null;
      }

      const sampleCues = [
        {
          id: "cue-1",
          cueIndex: 0,
          order: 1,
          speaker: "Alex",
          voice: "alex",
          text: "Hello, I am Alex.",
          audioUrl: null,
          audioFile: null,
          durationMs: 0,
          durationSeconds: 0,
          status: "idle",
          error: null,
          triggerMode: "manual_next",
        },
        {
          id: "cue-2",
          cueIndex: 1,
          order: 2,
          speaker: "Leo",
          voice: "leo",
          text: "Hello, I am Leo.",
          audioUrl: null,
          audioFile: null,
          durationMs: 0,
          durationSeconds: 0,
          status: "idle",
          error: null,
          triggerMode: "manual_next",
        },
        {
          id: "cue-3",
          cueIndex: 2,
          order: 3,
          speaker: "Maaya",
          voice: "maaya",
          text: "Hello, I am Maaya.",
          audioUrl: null,
          audioFile: null,
          durationMs: 0,
          durationSeconds: 0,
          status: "idle",
          error: null,
          triggerMode: "manual_next",
        },
      ];

      setCueTimeline({
        topic: "AI Voices Showcase",
        outline:
          "Sample multi-voice episode demonstrating Alex, Leo, and Maaya",
        triggerMode: "manual_next",
        cueCount: sampleCues.length,
        readyCueCount: 0,
        cues: sampleCues,
      });

      for (const cue of sampleCues) {
        setCueTimeline((prev) => {
          if (!prev || !Array.isArray(prev.cues)) return prev;
          return {
            ...prev,
            cues: prev.cues.map((item) =>
              item.id === cue.id
                ? { ...item, status: "generating", error: null }
                : item,
            ),
          };
        });

        const voice = cue.voice;
        console.log(
          "[TTS] Generating sample cue:",
          cue.id,
          "speaker:",
          cue.speaker,
          "voice:",
          voice,
        );

        try {
          const result = await generateSpeech(cue.text, voice);
          const audioUrl = getTtsAudioUrl(result.audio.fileName);

          setCueTimeline((prev) => {
            if (!prev || !Array.isArray(prev.cues)) return prev;
            const updated = prev.cues.map((c) =>
              c.id === cue.id
                ? {
                    ...c,
                    audioFile: result.audio.fileName,
                    audioUrl,
                    durationMs: result.audio.durationMs,
                    durationSeconds: Number(
                      (result.audio.durationMs / 1000).toFixed(3),
                    ),
                    status: "ready",
                    error: null,
                  }
                : c,
            );
            return {
              ...prev,
              cues: updated,
              readyCueCount: updated.filter((c) => c.status === "ready").length,
            };
          });
        } catch (cueErr) {
          console.error(
            `[TTS] Failed to generate sample cue ${cue.id}:`,
            cueErr,
          );
          const errorMessage = cueErr.message || "Failed to generate speech";
          setCueTimeline((prev) => {
            if (!prev || !Array.isArray(prev.cues)) return prev;
            const updated = prev.cues.map((c) =>
              c.id === cue.id
                ? {
                    ...c,
                    status: "error",
                    error: errorMessage,
                  }
                : c,
            );
            return {
              ...prev,
              cues: updated,
              readyCueCount: updated.filter((c) => c.status === "ready").length,
            };
          });
        }
      }
    } catch (err) {
      console.error("Failed to load sample cues:", err);
      setAiError(err.message || "Failed to generate sample cues.");
    } finally {
      setIsGeneratingCues(false);
    }
  }

  async function handleNextCue() {
    if (
      !cueTimeline ||
      !Array.isArray(cueTimeline.cues) ||
      cueTimeline.cues.length === 0
    ) {
      return;
    }

    if (isAiSpeaking) {
      return;
    }

    const nextIndex = currentCueIndex + 1;

    if (nextIndex >= cueTimeline.cues.length) {
      setAiError("All AI cues have been played.");

      return;
    }

    const cue = cueTimeline.cues[nextIndex];

    if (cue.status !== "ready" || !cue.audioUrl) {
      setAiError("Selected AI cue is not ready.");

      return;
    }

    setAiError("");

    setCurrentCueIndex(nextIndex);

    try {
      if (aiAudioRef.current) {
        aiAudioRef.current.pause();

        aiAudioRef.current = null;
      }

      const audio = new Audio(cue.audioUrl);

      aiAudioRef.current = audio;

      const isRecordingSession =
        isRecording && recordingClockRef.current !== null;

      let timelineEvent = null;

      if (isRecordingSession) {
        timelineEvent = addCueStartEvent(sessionId, cue);

        setTimelineEvents(getTimelineEvents(sessionId));
      }

      audio.onplay = () => {
        setIsAiSpeaking(true);

        if (timelineEvent && recordingClockRef.current !== null) {
          const elapsedMs = performance.now() - recordingClockRef.current;

          markCueStarted(sessionId, timelineEvent.eventId, elapsedMs);

          setTimelineEvents(getTimelineEvents(sessionId));

          console.log(
            `AI Cue ${cue.cueIndex + 1} started at ${Math.round(elapsedMs)} ms`,
          );
        }
      };

      audio.onended = () => {
        setIsAiSpeaking(false);

        if (timelineEvent && recordingClockRef.current !== null) {
          const elapsedMs = performance.now() - recordingClockRef.current;

          markCueEnded(sessionId, timelineEvent.eventId, elapsedMs);

          setTimelineEvents(getTimelineEvents(sessionId));

          console.log(
            `AI Cue ${cue.cueIndex + 1} ended at ${Math.round(elapsedMs)} ms`,
          );
        }

        aiAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsAiSpeaking(false);

        if (timelineEvent) {
          markCueFailed(
            sessionId,
            timelineEvent.eventId,
            "Failed to play AI audio",
          );

          setTimelineEvents(getTimelineEvents(sessionId));
        }

        aiAudioRef.current = null;

        setAiError("Failed to play AI cue.");
      };

      await audio.play();
    } catch (error) {
      console.error("AI cue playback failed:", error);

      setIsAiSpeaking(false);

      setAiError("Browser could not start AI audio playback.");
    }
  }

  async function handleRetry() {
    setError("");

    try {
      await retryFailedChunks();

      await loadBackendStatus(sessionId);
    } catch (error) {
      console.error("Retry failed:", error);

      setError(error.message);
    }
  }

  function startNewSession() {
    if (isRecording) {
      return;
    }

    if (sessionId) {
      clearSessionTimeline(sessionId);
    }

    localStorage.removeItem(ACTIVE_SESSION_KEY);

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

    if (aiAudioRef.current) {
      aiAudioRef.current.pause();

      aiAudioRef.current = null;
    }

    chunksRef.current = [];
    chunkIndexRef.current = 0;

    recordingClockRef.current = null;
  }

  const totalBackendChunks = status?.receivedChunkCount ?? 0;

  const expectedBackendChunks = status?.expectedChunkCount ?? null;

  const currentCue =
    cueTimeline && cueTimeline.cues && currentCueIndex >= 0
      ? cueTimeline.cues[currentCueIndex]
      : null;

  return (
    <div className="app-shell">
      <div className="app-container">
        {}

        <header className="app-header">
          <div>
            <div className="brand-row">
              <div className="brand-icon">🎙</div>

              <div>
                <h1>AI Podcast Studio</h1>
                <p>Create, record and produce podcasts with your AI co-host.</p>
              </div>
            </div>
          </div>

          <div className={`status-pill ${isRecording ? "recording" : ""}`}>
            <span className="status-dot"></span>
            {isRecording ? "Recording" : "Studio Ready"}
          </div>
        </header>

        {}

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

        {}

        <section className="session-bar">
          <div>
            <span className="section-label">CURRENT SESSION</span>

            <div className="session-id">
              {sessionId || "No session created"}
            </div>
          </div>

          <div className="session-actions">
            {!sessionId && (
              <button className="btn btn-primary" onClick={createNewSession}>
                + Create Session
              </button>
            )}

            {sessionId && !isRecording && (
              <button className="btn btn-secondary" onClick={startNewSession}>
                New Session
              </button>
            )}
          </div>
        </section>

        {}

        <div className="studio-grid">
          {}

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
                {isRecording ? (isPaused ? "PAUSED" : "REC") : "READY"}
              </div>
            </div>

            {}

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
                <button className="btn btn-warning" onClick={pauseRecording}>
                  ❚❚ Pause
                </button>
              )}

              {isRecording && isPaused && (
                <button className="btn btn-primary" onClick={resumeRecording}>
                  ▶ Resume
                </button>
              )}

              {isRecording && (
                <button className="btn btn-danger" onClick={stopRecording}>
                  ■ Stop
                </button>
              )}
            </div>

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

          {}

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
                      expectedBackendChunks && expectedBackendChunks > 0
                        ? `${Math.min(
                            (totalBackendChunks / expectedBackendChunks) * 100,
                            100,
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

        <VoiceGenerator
          selectedVoice={selectedVoice}
          onSelectVoice={setSelectedVoice}
        />

        {}

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
              Make sure all recording chunks are uploaded before creating the
              final host track.
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
                    {recordedBlob && (
                      <small className="muted-text">
                        ({(recordedBlob.size / 1024).toFixed(1)} KB raw)
                      </small>
                    )}
                  </div>

                  <strong>
                    {Number(hostRecording.durationSeconds || 0).toFixed(2)} sec
                  </strong>
                </div>

                <audio controls src={hostRecording.audioUrl} />
              </div>
            )}
          </section>
        )}

        {}

        <section className="card ai-card">
          <div className="ai-header">
            <div>
              <span className="card-eyebrow">AI CO-HOST</span>

              <h2>Plan your AI conversation</h2>

              <p>
                Choose your AI co-host voice, provide a topic and outline, and
                generate questions with synthesized voice audio.
              </p>
            </div>

            <div className="ai-orb">✦</div>
          </div>

          <div className="voice-selection-panel">
            <label className="field-label">Co-Host Voice</label>
            <div className="voice-selector-grid">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`voice-select-card ${
                    selectedVoice === v.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedVoice(v.id)}
                >
                  <span className="voice-card-emoji">🎙️</span>
                  <div className="voice-card-details">
                    <strong>{v.name}</strong>
                    <span>{v.gender}</span>
                    <small>{v.description}</small>
                  </div>
                  {selectedVoice === v.id && (
                    <span className="voice-card-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Topic</label>

              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. Artificial Intelligence in Software Development"
              />
            </div>

            <div className="form-field">
              <label>Outline</label>

              <textarea
                value={outline}
                onChange={(event) => setOutline(event.target.value)}
                rows={5}
                placeholder="Discuss the main points, questions and ideas for the episode..."
              />
            </div>
          </div>

          <div className="ai-actions-row">
            <button
              className="btn btn-gradient btn-large"
              onClick={handleGenerateCues}
              disabled={isGeneratingCues}
            >
              {isGeneratingCues
                ? "✦ Generating AI Cues..."
                : `✦ Generate AI Cues (${
                    VOICES.find((v) => v.id === selectedVoice)?.name || "Alex"
                  })`}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-large"
              onClick={handleLoadSampleCues}
              disabled={isGeneratingCues}
            >
              ✦ Load Sample Cues (Alex, Leo, Maaya)
            </button>
          </div>
        </section>

        {}

        {cueTimeline && (
          <section className="card cue-card">
            <div className="card-header">
              <div>
                <span className="card-eyebrow">AI CUE TIMELINE</span>

                <h2>AI Co-host Questions</h2>

                <p className="muted-text">
                  Play the generated cues while recording your episode. Each cue
                  uses its selected voice.
                </p>
              </div>

              <div className="cue-header-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRegenerateAllCues}
                  disabled={isGeneratingCues}
                >
                  ↻ Regenerate All Audio
                </button>
                <div className="cue-count">
                  <strong>{cueTimeline.readyCueCount}</strong>

                  <span>/ {cueTimeline.cueCount} ready</span>
                </div>
              </div>
            </div>

            {}

            <div className="cue-list">
              {cueTimeline.cues.map((cue) => {
                const isCurrent = cue.cueIndex === currentCueIndex;

                return (
                  <div
                    key={cue.id || cue.cueIndex}
                    className={`cue-item ${isCurrent ? "current" : ""}`}
                  >
                    <div className="cue-number">Cue {cue.cueIndex + 1}</div>

                    <div className="cue-content">
                      <div className="cue-top">
                        <div className="cue-identity">
                          <strong className="cue-speaker-name">
                            {cue.speaker || getSpeakerName(cue.voice)}
                          </strong>
                          <span className="cue-speaker-badge">
                            🎙️ {getVoiceDisplayName(cue.voice)}
                          </span>
                        </div>

                        <span
                          className={`cue-status cue-status-${cue.status || "idle"}`}
                        >
                          {cue.status || "idle"}
                        </span>
                      </div>

                      <p className="cue-text">{cue.text}</p>

                      <div className="cue-voice-selector">
                        <span className="cue-voice-label">Voice:</span>
                        <div className="cue-voice-buttons">
                          {VOICES.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className={`cue-voice-pill ${
                                cue.voice === v.id ? "active" : ""
                              }`}
                              onClick={() => handleCueVoiceChange(cue.id, v.id)}
                              disabled={
                                cue.status === "generating" || isGeneratingCues
                              }
                            >
                              {v.name}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            cue.status === "ready"
                              ? "btn-outline"
                              : "btn-primary"
                          }`}
                          onClick={() => handleGenerateSingleCue(cue.id)}
                          disabled={
                            cue.status === "generating" || isGeneratingCues
                          }
                        >
                          {cue.status === "generating"
                            ? "Generating..."
                            : cue.status === "ready" && cue.audioUrl
                              ? "↻ Regenerate Speech"
                              : "Generate Speech"}
                        </button>
                      </div>

                      {cue.error && (
                        <div className="cue-error-message">⚠️ {cue.error}</div>
                      )}

                      {cue.durationSeconds > 0 && (
                        <div className="cue-meta">
                          <span>◷ {cue.durationSeconds} sec</span>
                        </div>
                      )}

                      {cue.audioUrl && cue.status === "ready" && (
                        <audio controls preload="metadata" src={cue.audioUrl} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {}

            <div className={`ai-speaking ${isAiSpeaking ? "speaking" : ""}`}>
              <div className="speaker-icon">{isAiSpeaking ? "🔊" : "✦"}</div>

              <div>
                <strong>
                  AI Co-host {isAiSpeaking ? "is speaking" : "is ready"}
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

            {}

            {currentCue && (
              <div className="current-cue">
                <span className="card-eyebrow">CURRENT CUE</span>

                <h3>Cue {currentCue.cueIndex + 1}</h3>

                <p>{currentCue.text}</p>
              </div>
            )}

            {}

            <button
              className="btn btn-gradient btn-large full-width"
              onClick={handleNextCue}
              disabled={
                isAiSpeaking || currentCueIndex >= cueTimeline.cues.length - 1
              }
            >
              {currentCueIndex >= cueTimeline.cues.length - 1
                ? "✓ All Cues Played"
                : "▶ Play Next AI Cue"}
            </button>

            {!isRecording && (
              <p className="preview-note">
                Preview mode — cues played while you are not recording will not
                be added to the session timeline.
              </p>
            )}
          </section>
        )}

        {}

        {hostRecording && (
          <section className="card final-card">
            <div className="final-hero">
              <div className="final-icon">✨</div>

              <div>
                <span className="card-eyebrow">FINAL PRODUCTION</span>

                <h2>Create Final Podcast</h2>

                <p>
                  Mix your host recording with the AI co-host cues at their
                  recorded timestamps.
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
                    <span className="success-badge">✓ COMPLETE</span>

                    <h3>Your podcast is ready</h3>
                  </div>

                  <strong>
                    {Number(finalPodcast.wav?.durationSeconds || 0).toFixed(2)}{" "}
                    sec
                  </strong>
                </div>

                <audio controls src={finalPodcast.mp3Url} />

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

        {}

        {timelineEvents.length > 0 && (
          <section className="card timeline-card">
            <div className="card-header">
              <div>
                <span className="card-eyebrow">RECORDING TIMELINE</span>

                <h2>AI Cue Events</h2>
              </div>

              <div className="timeline-count">
                {timelineEvents.length} events
              </div>
            </div>

            <div className="event-list">
              {timelineEvents.map((event) => (
                <div key={event.eventId} className="event-item">
                  <div className="event-marker">
                    <span></span>
                  </div>

                  <div className="event-content">
                    <div className="event-header">
                      <strong>AI Cue {event.cueIndex + 1}</strong>

                      <span>{event.status}</span>
                    </div>

                    <p>{event.text}</p>

                    <div className="event-times">
                      <span>
                        Start:{" "}
                        {event.startOffsetMs !== null
                          ? `${(event.startOffsetMs / 1000).toFixed(3)} sec`
                          : "—"}
                      </span>

                      <span>
                        End:{" "}
                        {event.endOffsetMs !== null
                          ? `${(event.endOffsetMs / 1000).toFixed(3)} sec`
                          : "—"}
                      </span>

                      <span>
                        Duration:{" "}
                        {event.actualDurationMs !== null
                          ? `${(event.actualDurationMs / 1000).toFixed(3)} sec`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {}

        {status && (
          <section className="card backend-card">
            <div className="card-header">
              <div>
                <span className="card-eyebrow">BACKEND</span>

                <h2>Session Status</h2>
              </div>

              <div
                className={`backend-status ${
                  status.sequenceComplete ? "complete" : ""
                }`}
              >
                {status.sequenceComplete ? "✓ Complete" : "In Progress"}
              </div>
            </div>

            <div className="backend-grid">
              <div>
                <span>Sequence</span>

                <strong>
                  {status.sequenceComplete ? "Complete" : "Incomplete"}
                </strong>
              </div>

              <div>
                <span>Received Chunks</span>

                <strong>{status.receivedChunkCount ?? 0}</strong>
              </div>

              <div>
                <span>Expected Chunks</span>

                <strong>{status.expectedChunkCount ?? "—"}</strong>
              </div>

              <div>
                <span>Missing Chunks</span>

                <strong>{status.missingChunks?.length ?? 0}</strong>
              </div>
            </div>
          </section>
        )}

        {}

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
