import { useCallback, useState } from "react";
import {
  finalizeRecordingSession,
  getFinalRecordingUrl,
  mixPodcastSession,
  getRecordingSessionStatus,
} from "../services/recordingApi";
import { getTimelineEvents } from "../utils/sessionTimeline";

export default function usePodcastExport({ onError, onSuccess }) {
  const [hostRecording, setHostRecording] = useState(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalPodcast, setFinalPodcast] = useState(null);
  const [isMixing, setIsMixing] = useState(false);
  const [transcript, setTranscript] = useState([]);

  const handleFinalizeRecording = useCallback(
    async ({
      sessionId,
      retryFailedChunks,
      waitForUploads,
      totalChunks,
      onStatusUpdate,
    }) => {
      if (!sessionId) {
        onError?.("No session ID available to finalize.");
        return;
      }

      try {
        setIsFinalizing(true);
        await retryFailedChunks?.();
        await waitForUploads?.();

        const latestStatus = await getRecordingSessionStatus(sessionId);
        onStatusUpdate?.(latestStatus);

        if (
          (!latestStatus || latestStatus.receivedChunkCount === 0) &&
          totalChunks === 0
        ) {
          throw new Error(
            "No recording chunks available to finalize. Please record audio first.",
          );
        }

        if (
          latestStatus.missingChunks &&
          latestStatus.missingChunks.length > 0
        ) {
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

        const recordingData = {
          ...result,
          audioUrl: getFinalRecordingUrl(sessionId),
        };

        setHostRecording(recordingData);
        onSuccess?.("Host recording finalized successfully.");
        return recordingData;
      } catch (error) {
        console.error("Host recording finalization failed:", error);
        onError?.(error.message || "Failed to finalize host recording.");
        throw error;
      } finally {
        setIsFinalizing(false);
      }
    },
    [onError, onSuccess],
  );

  const handleMixPodcast = useCallback(
    async ({ sessionId, cueTimeline }) => {
      if (!sessionId || !hostRecording) {
        onError?.(
          "Host recording must be finalized before producing the podcast.",
        );
        return;
      }

      // Validate that all cues have generated audio before mixing
      if (cueTimeline?.cues && Array.isArray(cueTimeline.cues)) {
        for (const cue of cueTimeline.cues) {
          if (cue.status !== "ready" || !cue.audioFile) {
            const errorMsg = `Cannot finalize: Cue ${cue.cueIndex + 1} has no generated audio.`;
            onError?.(errorMsg);
            throw new Error(errorMsg);
          }
        }
      }

      try {
        setIsMixing(true);
        const events = getTimelineEvents(sessionId);

        const result = await mixPodcastSession(sessionId, events);
        setFinalPodcast(result);
        if (result.transcript) {
          setTranscript(result.transcript);
        }

        onSuccess?.("Final podcast mixed and mastered successfully!");
        return result;
      } catch (error) {
        console.error("Podcast mixing failed:", error);
        onError?.(error.message || "Failed to mix podcast.");
        throw error;
      } finally {
        setIsMixing(false);
      }
    },
    [hostRecording, onError, onSuccess],
  );

  const resetExport = useCallback(() => {
    setHostRecording(null);
    setFinalPodcast(null);
    setTranscript([]);
    setIsFinalizing(false);
    setIsMixing(false);
  }, []);

  return {
    hostRecording,
    setHostRecording,
    isFinalizing,
    finalPodcast,
    setFinalPodcast,
    isMixing,
    transcript,
    setTranscript,
    handleFinalizeRecording,
    handleMixPodcast,
    resetExport,
  };
}
