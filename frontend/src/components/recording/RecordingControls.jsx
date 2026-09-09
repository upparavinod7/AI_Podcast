import React from "react";
import Button from "../common/Button";

export default function RecordingControls({
  sessionId,
  isRecording = false,
  isPaused = false,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onCreateSession,
}) {
  if (!sessionId) {
    return (
      <Button
        variant="primary"
        size="lg"
        onClick={onCreateSession}
        className="w-full sm:w-auto"
      >
        Create Session
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!isRecording ? (
        <Button
          variant="gradient"
          size="lg"
          onClick={onStartRecording}
          icon="●"
          className="shadow-md"
        >
          Start Recording
        </Button>
      ) : (
        <>
          {!isPaused ? (
            <Button
              variant="warning"
              size="md"
              onClick={onPauseRecording}
              icon="❚❚"
            >
              Pause
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={onResumeRecording}
              icon="▶"
            >
              Resume
            </Button>
          )}

          <Button
            variant="danger"
            size="md"
            onClick={onStopRecording}
            icon="■"
            className="shadow-sm"
          >
            Stop Recording
          </Button>
        </>
      )}
    </div>
  );
}
