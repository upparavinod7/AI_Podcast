import { useCallback, useEffect, useMemo, useState } from "react";
import AppContainer from "./components/layout/AppContainer";
import AppHeader from "./components/layout/AppHeader";
import SessionCard from "./components/session/SessionCard";
import SessionStatus from "./components/session/SessionStatus";
import RecoveryBanner from "./components/recording/RecoveryBanner";
import RecordingPanel from "./components/recording/RecordingPanel";
import CoHostPanel from "./components/cohost/CoHostPanel";
import CueTimeline from "./components/cues/CueTimeline";
import FinalizePodcast from "./components/export/FinalizePodcast";
import PodcastResult from "./components/export/PodcastResult";
import RecordingTimelineEvents from "./components/cues/RecordingTimelineEvents";
import ErrorMessage from "./components/common/ErrorMessage";

import useChunkUploader from "./hooks/useChunkUploader";
import useRecording from "./hooks/useRecording";
import useCueTimeline from "./hooks/useCueTimeline";
import usePodcastExport from "./hooks/usePodcastExport";

import {
  createRecordingSession,
  getRecordingSessionStatus,
} from "./services/recordingApi";
import { getVoiceDisplayName } from "./services/ttsApi";
import {
  startRecordingTimeline,
  stopRecordingTimeline,
  getTimelineEvents,
  clearSessionTimeline,
} from "./utils/sessionTimeline";
import { getSessionChunks, clearSessionChunks } from "./utils/indexedDB";

const ACTIVE_SESSION_KEY = "ai_podcast_active_session_id";

export default function App() {
  const [sessionId, setSessionId] = useState(
    () => localStorage.getItem(ACTIVE_SESSION_KEY) || "",
  );
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const [recoverySession, setRecoverySession] = useState(null);

  const [selectedVoice, setSelectedVoice] = useState("alex");
  const [topic, setTopic] = useState(
    "Artificial Intelligence in Software Development",
  );
  const [outline, setOutline] = useState(
    "Discuss AI coding assistants, automation, impact on developers, software jobs, and the future of programming.",
  );

  // 1. IndexedDB Chunk Uploader Hook
  const uploader = useChunkUploader(sessionId);

  // 2. Podcast Export Hook (Finalization & Mix)
  const exportCtrl = usePodcastExport({
    onError: setError,
    onSuccess: (msg) => console.log(msg),
  });

  // 3. Cue Timeline Hook (AI Cues & Playback)
  const cues = useCueTimeline({
    sessionId,
    onError: setError,
  });

  // Check for recovery sessions in IndexedDB on mount
  useEffect(() => {
    async function checkRecoverySession() {
      if (!sessionId) return;
      try {
        const chunks = await getSessionChunks(sessionId);
        if (chunks.length > 0) {
          const uploaded = chunks.filter((c) => c.status === "uploaded").length;
          const pending = chunks.filter(
            (c) => c.status === "pending" || c.status === "uploading",
          ).length;
          const failed = chunks.filter((c) => c.status === "failed").length;

          if (pending > 0 || failed > 0) {
            setRecoverySession({
              sessionId,
              totalChunks: chunks.length,
              uploaded,
              pending,
              failed,
            });
          }
        }
      } catch (err) {
        console.warn("Could not check recovery session:", err);
      }
    }
    void checkRecoverySession();
  }, [sessionId]);

  const loadBackendStatus = useCallback(async (activeSessionId) => {
    if (!activeSessionId) return;
    try {
      const res = await getRecordingSessionStatus(activeSessionId);
      setStatus(res);
    } catch (err) {
      console.warn("Could not load backend status:", err);
    }
  }, []);

  // 4. Recording Hook (MediaRecorder)
  const recording = useRecording({
    sessionId,
    onChunkCaptured: async (chunkIndex, blob) => {
      await uploader.queueChunk(chunkIndex, blob);
    },
    onStopCallback: async (activeSessionId) => {
      await uploader.waitForUploads();
      await loadBackendStatus(activeSessionId);
      stopRecordingTimeline(activeSessionId);
      cues.setTimelineEvents(getTimelineEvents(activeSessionId));
    },
    onError: setError,
  });

  // Save session ID
  const updateSessionId = useCallback((newId) => {
    setSessionId(newId);
    if (newId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, newId);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  }, []);

  const createNewSession = useCallback(async () => {
    try {
      setError("");
      const res = await createRecordingSession();
      const newSessionId = res.sessionId || res.data?.sessionId;
      updateSessionId(newSessionId);
      setStatus(null);
      setRecoverySession(null);
      exportCtrl.resetExport();
      await loadBackendStatus(newSessionId);
    } catch (err) {
      console.error("Failed to create session:", err);
      setError(err.message || "Could not create session.");
    }
  }, [updateSessionId, exportCtrl, loadBackendStatus]);

  const startNewSession = useCallback(async () => {
    if (recording.isRecording) {
      recording.stopRecording();
    }
    cues.safeStopAiAudio(sessionId, recording.recordingClockRef);
    await createNewSession();
  }, [recording, cues, sessionId, createNewSession]);

  const handleStartRecording = useCallback(async () => {
    setError("");
    let activeId = sessionId;
    if (!activeId) {
      const res = await createRecordingSession();
      activeId = res.sessionId || res.data?.sessionId;
      updateSessionId(activeId);
    }

    startRecordingTimeline(activeId);
    cues.setTimelineEvents(getTimelineEvents(activeId));
    await recording.startRecording(activeId);
  }, [sessionId, updateSessionId, cues, recording]);

  const handleStopRecording = useCallback(() => {
    cues.safeStopAiAudio(sessionId, recording.recordingClockRef);
    recording.stopRecording();
  }, [cues, sessionId, recording]);

  const handleResumeAndFinalize = useCallback(async () => {
    try {
      setError("");
      await uploader.retryFailedChunks();
      await uploader.waitForUploads();
      await exportCtrl.handleFinalizeRecording({
        sessionId,
        retryFailedChunks: uploader.retryFailedChunks,
        waitForUploads: uploader.waitForUploads,
        totalChunks: uploader.totalChunks,
        onStatusUpdate: setStatus,
      });
      setRecoverySession(null);
    } catch (err) {
      console.error("Resume and finalize failed:", err);
      setError(err.message || "Failed to resume and finalize.");
    }
  }, [uploader, exportCtrl, sessionId]);

  const handleDiscardSession = useCallback(async () => {
    if (sessionId) {
      await clearSessionChunks(sessionId).catch(() => {});
      clearSessionTimeline(sessionId);
    }
    setRecoverySession(null);
    await createNewSession();
  }, [sessionId, createNewSession]);

  // Speaking indicator status derivation
  const speakingState = useMemo(() => {
    if (error) return "ERROR";
    if (recording.isRecording) {
      if (recording.isPaused) return "PAUSED";
      if (cues.isAiSpeaking) return "AI_SPEAKING";
      return "HOST_SPEAKING";
    }
    if (exportCtrl.hostRecording) return "COMPLETED";
    return "READY";
  }, [
    error,
    recording.isRecording,
    recording.isPaused,
    cues.isAiSpeaking,
    exportCtrl.hostRecording,
  ]);

  const speakingLabel = useMemo(() => {
    switch (speakingState) {
      case "AI_SPEAKING":
        return "AI CO-HOST SPEAKING";
      case "HOST_SPEAKING":
        return "HOST SPEAKING";
      case "PAUSED":
        return "RECORDING PAUSED";
      case "COMPLETED":
        return "RECORDING COMPLETED";
      case "ERROR":
        return "SYSTEM ERROR";
      case "READY":
      default:
        return "STUDIO READY";
    }
  }, [speakingState]);

  const speakingVoiceName = useMemo(() => {
    if (speakingState !== "AI_SPEAKING") return null;
    const activeCue = cues.cueTimeline?.cues?.[cues.currentCueIndex];
    const v = activeCue?.voice || selectedVoice;
    return getVoiceDisplayName(v);
  }, [speakingState, cues.cueTimeline, cues.currentCueIndex, selectedVoice]);

  const currentCue = cues.cueTimeline?.cues?.[cues.currentCueIndex] || null;

  return (
    <AppContainer>
      <AppHeader
        isRecording={recording.isRecording}
        isPaused={recording.isPaused}
        isAiSpeaking={cues.isAiSpeaking}
        hostRecording={exportCtrl.hostRecording}
      />

      {recoverySession && !recording.isRecording && (
        <RecoveryBanner
          recoverySession={recoverySession}
          isFinalizing={exportCtrl.isFinalizing}
          isUploading={uploader.isUploading}
          onResumeAndFinalize={handleResumeAndFinalize}
          onDiscardSession={handleDiscardSession}
        />
      )}

      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError("")}
          className="mb-6"
        />
      )}

      <SessionCard
        sessionId={sessionId}
        isRecording={recording.isRecording}
        onCreateSession={createNewSession}
        onNewSession={startNewSession}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <RecordingPanel
          sessionId={sessionId}
          isRecording={recording.isRecording}
          isPaused={recording.isPaused}
          micReady={recording.micReady}
          speakingState={speakingState}
          speakingLabel={speakingLabel}
          speakingVoiceName={speakingVoiceName}
          error={error}
          onCreateSession={createNewSession}
          onStartRecording={handleStartRecording}
          onPauseRecording={recording.pauseRecording}
          onResumeRecording={recording.resumeRecording}
          onStopRecording={handleStopRecording}
          cueTimeline={cues.cueTimeline}
          currentCueIndex={cues.currentCueIndex}
          currentCue={currentCue}
          isAiSpeaking={cues.isAiSpeaking}
          onPreviousCue={cues.handlePreviousCue}
          onNextCue={() =>
            cues.handleNextCue(
              recording.isRecording,
              recording.recordingClockRef,
            )
          }
          uploaderStats={{
            uploadedCount: uploader.uploadedCount,
            pendingCount: uploader.pendingCount,
            failedCount: uploader.failedCount,
            totalChunks: uploader.totalChunks,
            isUploading: uploader.isUploading,
            isRetrying: uploader.isRetrying,
            lastError: uploader.lastError,
          }}
          onRetryFailedChunks={uploader.retryFailedChunks}
        />

        <CoHostPanel
          selectedVoice={selectedVoice}
          onSelectVoice={setSelectedVoice}
          topic={topic}
          onTopicChange={setTopic}
          outline={outline}
          onOutlineChange={setOutline}
          isGeneratingCues={cues.isGeneratingCues}
          onGenerateCues={() =>
            cues.handleGenerateCues(topic, outline, selectedVoice)
          }
          onLoadSampleCues={() => cues.handleLoadSampleCues(selectedVoice)}
        />
      </div>

      <CueTimeline
        cueTimeline={cues.cueTimeline}
        currentCueIndex={cues.currentCueIndex}
        isGeneratingCues={cues.isGeneratingCues}
        isAiSpeaking={cues.isAiSpeaking}
        isRecording={recording.isRecording}
        onVoiceChange={cues.handleCueVoiceChange}
        onGenerateSingleCue={cues.handleGenerateSingleCue}
        onRegenerateAllCues={cues.handleRegenerateAllCues}
        onPreviousCue={cues.handlePreviousCue}
        onNextCue={() =>
          cues.handleNextCue(recording.isRecording, recording.recordingClockRef)
        }
      />

      <FinalizePodcast
        hostRecording={exportCtrl.hostRecording}
        isFinalizing={exportCtrl.isFinalizing}
        isUploading={uploader.isUploading}
        totalChunks={uploader.totalChunks}
        receivedChunkCount={status?.receivedChunkCount ?? 0}
        failedCount={uploader.failedCount}
        pendingCount={uploader.pendingCount}
        isRecording={recording.isRecording}
        onFinalizeRecording={() =>
          exportCtrl.handleFinalizeRecording({
            sessionId,
            retryFailedChunks: uploader.retryFailedChunks,
            waitForUploads: uploader.waitForUploads,
            totalChunks: uploader.totalChunks,
            onStatusUpdate: setStatus,
          })
        }
      />

      <PodcastResult
        hostRecording={exportCtrl.hostRecording}
        finalPodcast={exportCtrl.finalPodcast}
        isMixing={exportCtrl.isMixing}
        transcript={exportCtrl.transcript}
        onMixPodcast={() =>
          exportCtrl.handleMixPodcast({
            sessionId,
            cueTimeline: cues.cueTimeline,
          })
        }
      />

      <RecordingTimelineEvents timelineEvents={cues.timelineEvents} />

      <SessionStatus status={status} />
    </AppContainer>
  );
}
