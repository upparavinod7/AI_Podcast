import React from "react";
import Card from "../common/Card";
import SectionHeader from "../layout/SectionHeader";
import SpeakingIndicator from "./SpeakingIndicator";
import RecordingControls from "./RecordingControls";
import LiveCueController from "./LiveCueController";
import UploadStatus from "./UploadStatus";

export default function RecordingPanel({
  sessionId,
  isRecording = false,
  isPaused = false,
  micReady = false,
  speakingState = "READY",
  speakingLabel = "Studio Ready",
  speakingVoiceName = null,
  error = "",
  onCreateSession,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  cueTimeline,
  currentCueIndex,
  currentCue,
  isAiSpeaking,
  onPreviousCue,
  onNextCue,
  uploaderStats = {},
  onRetryFailedChunks,
}) {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <SectionHeader
          eyebrow="RECORDING STUDIO"
          title="Host Recording"
          description="Speak into your microphone and trigger AI co-host cues when prompted."
          icon={isRecording ? "●" : "🎙️"}
        />

        <SpeakingIndicator
          speakingState={speakingState}
          speakingLabel={speakingLabel}
          speakingVoiceName={speakingVoiceName}
          micReady={micReady}
          error={error}
        />

        <RecordingControls
          sessionId={sessionId}
          isRecording={isRecording}
          isPaused={isPaused}
          onStartRecording={onStartRecording}
          onPauseRecording={onPauseRecording}
          onResumeRecording={onResumeRecording}
          onStopRecording={onStopRecording}
          onCreateSession={onCreateSession}
        />

        {cueTimeline && cueTimeline.cues?.length > 0 && (
          <LiveCueController
            cueTimeline={cueTimeline}
            currentCueIndex={currentCueIndex}
            currentCue={currentCue}
            isAiSpeaking={isAiSpeaking}
            isRecording={isRecording}
            onPreviousCue={onPreviousCue}
            onNextCue={onNextCue}
          />
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Microphone:{" "}
            <strong
              className={`font-semibold ${
                micReady ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {micReady ? "Connected" : "Standby"}
            </strong>
          </span>
          {isRecording && (
            <span className="flex items-center gap-1.5 text-rose-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              RECORDING
            </span>
          )}
        </div>

        <UploadStatus
          uploadedCount={uploaderStats.uploadedCount}
          pendingCount={uploaderStats.pendingCount}
          failedCount={uploaderStats.failedCount}
          totalChunks={uploaderStats.totalChunks}
          isUploading={uploaderStats.isUploading}
          isRetrying={uploaderStats.isRetrying}
          lastError={uploaderStats.lastError}
          onRetryFailed={onRetryFailedChunks}
        />
      </div>
    </Card>
  );
}
