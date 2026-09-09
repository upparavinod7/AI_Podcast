import React from "react";
import Badge from "../common/Badge";

export default function AppHeader({
  isRecording = false,
  isPaused = false,
  isAiSpeaking = false,
  hostRecording = null,
}) {
  const getStatusBadge = () => {
    if (isRecording) {
      if (isAiSpeaking) {
        return (
          <Badge
            variant="purple"
            size="md"
            dot
            className="animate-pulse shadow-sm"
          >
            AI Co-Host Speaking
          </Badge>
        );
      }
      if (isPaused) {
        return (
          <Badge variant="warning" size="md" dot>
            Recording Paused
          </Badge>
        );
      }
      return (
        <Badge
          variant="danger"
          size="md"
          dot
          className="animate-pulse shadow-sm"
        >
          Recording Live
        </Badge>
      );
    }

    if (hostRecording) {
      return (
        <Badge variant="success" size="md" dot>
          Recording Ready
        </Badge>
      );
    }

    return (
      <Badge variant="neutral" size="md" dot>
        Studio Ready
      </Badge>
    );
  };

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 mb-8">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-md shadow-violet-200 flex-shrink-0">
          🎙️
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            AI Podcast Studio
          </h1>
          <p className="text-sm text-slate-500 font-normal">
            Create, record, and produce podcasts with your AI co-host.
          </p>
        </div>
      </div>
      <div className="self-start sm:self-center">{getStatusBadge()}</div>
    </header>
  );
}
