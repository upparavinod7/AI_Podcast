import { useCallback, useRef, useState, useEffect } from "react";
import {
  generateSpeech,
  getTtsAudioUrl,
  normalizeVoice,
  getSpeakerName,
} from "../services/ttsApi";
import { generateCoHostTimeline } from "../services/recordingApi";
import {
  addCueStartEvent,
  markCueStarted,
  markCueEnded,
  markCueFailed,
  getTimelineEvents,
} from "../utils/sessionTimeline";

export default function useCueTimeline({ sessionId, onError }) {
  const [cueTimeline, setCueTimeline] = useState(null);
  const [currentCueIndex, setCurrentCueIndex] = useState(-1);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isGeneratingCues, setIsGeneratingCues] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);

  const aiAudioRef = useRef(null);

  // Sync timeline events from session storage
  useEffect(() => {
    if (sessionId) {
      setTimelineEvents(getTimelineEvents(sessionId));
    } else {
      setTimelineEvents([]);
    }
  }, [sessionId]);

  const safeStopAiAudio = useCallback(
    (activeSessionId, recordingClockRef) => {
      if (aiAudioRef.current) {
        try {
          aiAudioRef.current.pause();
        } catch (e) {
          console.warn("Error pausing AI audio:", e);
        }
        aiAudioRef.current = null;
      }

      if (isAiSpeaking) {
        setIsAiSpeaking(false);
        const sid = activeSessionId || sessionId;
        if (sid && recordingClockRef?.current !== null) {
          const events = getTimelineEvents(sid);
          const openEvent = events
            .slice()
            .reverse()
            .find((e) => e.status === "playing" && e.endOffsetMs === null);
          if (openEvent) {
            const elapsedMs = performance.now() - recordingClockRef.current;
            markCueEnded(sid, openEvent.eventId, elapsedMs);
            setTimelineEvents(getTimelineEvents(sid));
          }
        }
      }
    },
    [sessionId, isAiSpeaking],
  );

  const handleCueVoiceChange = useCallback((cueId, newVoice) => {
    const validVoice = normalizeVoice(newVoice);
    setCueTimeline((prev) => {
      if (!prev || !Array.isArray(prev.cues)) return prev;

      const updatedCues = prev.cues.map((cue) => {
        if (cue.id === cueId) {
          return {
            ...cue,
            voice: validVoice,
            speaker: getSpeakerName(validVoice),
            status: "idle",
            audioUrl: null,
            audioFile: null,
            durationSeconds: 0,
            durationMs: 0,
            error: null,
          };
        }
        return cue;
      });

      return {
        ...prev,
        cues: updatedCues,
        readyCueCount: updatedCues.filter((c) => c.status === "ready").length,
      };
    });
  }, []);

  const handleGenerateSingleCue = useCallback(
    async (cueId) => {
      if (!cueTimeline || !Array.isArray(cueTimeline.cues)) return;
      const targetCue = cueTimeline.cues.find((c) => c.id === cueId);
      if (!targetCue) return;

      setCueTimeline((prev) => {
        if (!prev) return prev;
        const updated = prev.cues.map((c) =>
          c.id === cueId ? { ...c, status: "generating", error: null } : c,
        );
        return { ...prev, cues: updated };
      });

      try {
        const response = await generateSpeech(targetCue.text, targetCue.voice);
        const audio = response.audio;

        setCueTimeline((prev) => {
          if (!prev) return prev;
          const updated = prev.cues.map((c) =>
            c.id === cueId
              ? {
                  ...c,
                  status: "ready",
                  audioFile: audio.fileName,
                  audioUrl: getTtsAudioUrl(audio.fileName),
                  durationMs: audio.durationMs,
                  durationSeconds: Number((audio.durationMs / 1000).toFixed(3)),
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
      } catch (err) {
        console.error("Single cue generation failed:", err);
        const errorMsg = err.message || "Failed to generate speech";
        setCueTimeline((prev) => {
          if (!prev) return prev;
          const updated = prev.cues.map((c) =>
            c.id === cueId ? { ...c, status: "error", error: errorMsg } : c,
          );
          return {
            ...prev,
            cues: updated,
            readyCueCount: updated.filter((c) => c.status === "ready").length,
          };
        });
        onError?.(errorMsg);
      }
    },
    [cueTimeline, onError],
  );

  const handleRegenerateAllCues = useCallback(async () => {
    if (!cueTimeline || !Array.isArray(cueTimeline.cues)) return;

    setIsGeneratingCues(true);
    for (const cue of cueTimeline.cues) {
      await handleGenerateSingleCue(cue.id);
    }
    setIsGeneratingCues(false);
  }, [cueTimeline, handleGenerateSingleCue]);

  const handleGenerateCues = useCallback(
    async (topic, outline, selectedVoice) => {
      try {
        setIsGeneratingCues(true);
        setCueTimeline(null);
        setCurrentCueIndex(-1);
        setIsAiSpeaking(false);

        if (aiAudioRef.current) {
          aiAudioRef.current.pause();
          aiAudioRef.current = null;
        }

        const activeVoice = normalizeVoice(selectedVoice);
        const result = await generateCoHostTimeline(
          topic,
          outline,
          activeVoice,
        );

        if (!result || !Array.isArray(result.cues)) {
          throw new Error("Invalid AI cue response");
        }

        const initialCues = result.cues.map((item, index) => {
          const cueVoice = normalizeVoice(item.voice || activeVoice);
          return {
            id: item.id || `cue-${index + 1}`,
            cueIndex: index,
            order: item.order || index + 1,
            speaker: item.speaker || getSpeakerName(cueVoice),
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
          readyCueCount: initialCues.filter((c) => c.status === "ready").length,
        });

        // Generate audio for any cues that don't have audioUrl yet
        for (const cue of initialCues) {
          if (!cue.audioUrl) {
            try {
              const res = await generateSpeech(cue.text, cue.voice);
              const audio = res.audio;
              setCueTimeline((prev) => {
                if (!prev) return prev;
                const updated = prev.cues.map((c) =>
                  c.id === cue.id
                    ? {
                        ...c,
                        status: "ready",
                        audioFile: audio.fileName,
                        audioUrl: getTtsAudioUrl(audio.fileName),
                        durationMs: audio.durationMs,
                        durationSeconds: Number(
                          (audio.durationMs / 1000).toFixed(3),
                        ),
                        error: null,
                      }
                    : c,
                );
                return {
                  ...prev,
                  cues: updated,
                  readyCueCount: updated.filter((c) => c.status === "ready")
                    .length,
                };
              });
            } catch (err) {
              console.error(`Audio generation failed for ${cue.id}:`, err);
              setCueTimeline((prev) => {
                if (!prev) return prev;
                const updated = prev.cues.map((c) =>
                  c.id === cue.id
                    ? { ...c, status: "error", error: err.message }
                    : c,
                );
                return {
                  ...prev,
                  cues: updated,
                  readyCueCount: updated.filter((c) => c.status === "ready")
                    .length,
                };
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to generate cues:", err);
        onError?.(err.message || "Failed to generate AI co-host cues.");
      } finally {
        setIsGeneratingCues(false);
      }
    },
    [onError],
  );

  const handleLoadSampleCues = useCallback(async () => {
    const sampleDefinitions = [
      {
        id: "cue-1",
        cueIndex: 0,
        order: 1,
        speaker: "Alex",
        voice: "alex",
        text: "Welcome to AI Podcast Studio. Today we are exploring the rapid evolution of artificial intelligence in programming.",
      },
      {
        id: "cue-2",
        cueIndex: 1,
        order: 2,
        speaker: "Leo",
        voice: "leo",
        text: "What are the biggest challenges developers face when adopting automated workflows into their daily architecture?",
      },
      {
        id: "cue-3",
        cueIndex: 2,
        order: 3,
        speaker: "Maaya",
        voice: "maaya",
        text: "Looking into the future, how do you envision the partnership between human engineers and AI assistants unfolding?",
      },
    ];

    setIsGeneratingCues(true);
    setCurrentCueIndex(-1);
    setIsAiSpeaking(false);

    if (aiAudioRef.current) {
      aiAudioRef.current.pause();
      aiAudioRef.current = null;
    }

    const initialCues = sampleDefinitions.map((d) => ({
      ...d,
      audioFile: null,
      audioUrl: null,
      durationMs: 0,
      durationSeconds: 0,
      triggerMode: "manual_next",
      status: "generating",
    }));

    setCueTimeline({
      sessionId: sessionId || "sample-session",
      cueCount: initialCues.length,
      readyCueCount: 0,
      cues: initialCues,
    });

    for (const cue of initialCues) {
      try {
        const res = await generateSpeech(cue.text, cue.voice);
        const audio = res.audio;
        setCueTimeline((prev) => {
          if (!prev) return prev;
          const updated = prev.cues.map((c) =>
            c.id === cue.id
              ? {
                  ...c,
                  status: "ready",
                  audioFile: audio.fileName,
                  audioUrl: getTtsAudioUrl(audio.fileName),
                  durationMs: audio.durationMs,
                  durationSeconds: Number((audio.durationMs / 1000).toFixed(3)),
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
      } catch (err) {
        console.error(`Sample cue audio generation failed for ${cue.id}:`, err);
        setCueTimeline((prev) => {
          if (!prev) return prev;
          const updated = prev.cues.map((c) =>
            c.id === cue.id ? { ...c, status: "error", error: err.message } : c,
          );
          return {
            ...prev,
            cues: updated,
            readyCueCount: updated.filter((c) => c.status === "ready").length,
          };
        });
      }
    }

    setIsGeneratingCues(false);
  }, [sessionId]);

  const handlePreviousCue = useCallback(() => {
    if (!cueTimeline?.cues || isAiSpeaking || currentCueIndex <= 0) return;
    setCurrentCueIndex((prev) => prev - 1);
  }, [cueTimeline, isAiSpeaking, currentCueIndex]);

  const handleNextCue = useCallback(
    async (isRecording, recordingClockRef) => {
      if (!cueTimeline?.cues || isAiSpeaking) return;

      const nextIndex = currentCueIndex + 1;
      if (nextIndex >= cueTimeline.cues.length) {
        onError?.("All AI cues have been played.");
        return;
      }

      const cue = cueTimeline.cues[nextIndex];
      if (cue.status !== "ready" || !cue.audioUrl) {
        onError?.(
          `Cue ${nextIndex + 1} (${cue.speaker || cue.voice}) has no audio. Please generate speech before playing.`,
        );
        return;
      }

      setCurrentCueIndex(nextIndex);

      try {
        if (aiAudioRef.current) {
          aiAudioRef.current.pause();
          aiAudioRef.current = null;
        }

        const audio = new Audio(cue.audioUrl);
        aiAudioRef.current = audio;

        const isRecordingSession =
          isRecording && recordingClockRef?.current !== null;
        let timelineEvent = null;

        if (isRecordingSession && sessionId) {
          timelineEvent = addCueStartEvent(sessionId, cue);
          setTimelineEvents(getTimelineEvents(sessionId));
        }

        audio.onplay = () => {
          setIsAiSpeaking(true);
          if (
            timelineEvent &&
            sessionId &&
            recordingClockRef?.current !== null
          ) {
            const elapsedMs = performance.now() - recordingClockRef.current;
            markCueStarted(sessionId, timelineEvent.eventId, elapsedMs);
            setTimelineEvents(getTimelineEvents(sessionId));
          }
        };

        audio.onended = () => {
          setIsAiSpeaking(false);
          if (
            timelineEvent &&
            sessionId &&
            recordingClockRef?.current !== null
          ) {
            const elapsedMs = performance.now() - recordingClockRef.current;
            markCueEnded(sessionId, timelineEvent.eventId, elapsedMs);
            setTimelineEvents(getTimelineEvents(sessionId));
          }
          aiAudioRef.current = null;
        };

        audio.onerror = () => {
          setIsAiSpeaking(false);
          if (timelineEvent && sessionId) {
            markCueFailed(
              sessionId,
              timelineEvent.eventId,
              "Failed to play AI audio",
            );
            setTimelineEvents(getTimelineEvents(sessionId));
          }
          aiAudioRef.current = null;
          onError?.(`Failed to play audio for Cue ${cue.cueIndex + 1}.`);
        };

        await audio.play();
      } catch (err) {
        console.error("Audio playback error:", err);
        setIsAiSpeaking(false);
        onError?.(err.message || "Failed to start AI cue playback.");
      }
    },
    [cueTimeline, isAiSpeaking, currentCueIndex, sessionId, onError],
  );

  return {
    cueTimeline,
    setCueTimeline,
    currentCueIndex,
    setCurrentCueIndex,
    isAiSpeaking,
    setIsAiSpeaking,
    isGeneratingCues,
    timelineEvents,
    setTimelineEvents,
    safeStopAiAudio,
    handleGenerateCues,
    handleLoadSampleCues,
    handleCueVoiceChange,
    handleGenerateSingleCue,
    handleRegenerateAllCues,
    handlePreviousCue,
    handleNextCue,
  };
}
