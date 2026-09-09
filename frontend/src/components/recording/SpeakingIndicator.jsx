import React from "react";

export default function SpeakingIndicator({
  speakingState = "READY",
  speakingLabel = "Studio Ready",
  speakingVoiceName = null,
  micReady = false,
  error = "",
}) {
  const isAiSpeaking = speakingState === "AI_SPEAKING";
  const isHostSpeaking = speakingState === "HOST_SPEAKING";
  const isPaused = speakingState === "PAUSED";
  const isCompleted = speakingState === "COMPLETED";

  const getContainerStyle = () => {
    if (isAiSpeaking) {
      return "bg-violet-50/90 border-violet-200 text-violet-950 ring-1 ring-violet-300/60";
    }
    if (isHostSpeaking) {
      return "bg-rose-50/90 border-rose-200 text-rose-950 ring-1 ring-rose-300/60";
    }
    if (isPaused) {
      return "bg-amber-50/90 border-amber-200 text-amber-950";
    }
    if (isCompleted) {
      return "bg-emerald-50/90 border-emerald-200 text-emerald-950";
    }
    return "bg-slate-50 border-slate-200 text-slate-700";
  };

  const getDotStyle = () => {
    if (isAiSpeaking) return "bg-violet-500";
    if (isHostSpeaking) return "bg-rose-500 animate-ping";
    if (isPaused) return "bg-amber-500";
    if (isCompleted) return "bg-emerald-500";
    return micReady ? "bg-emerald-500" : "bg-slate-400";
  };

  return (
    <div
      className={`rounded-2xl border p-4 mb-6 transition-all duration-200 flex items-center justify-between gap-4 ${getContainerStyle()}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex items-center justify-center w-4 h-4 flex-shrink-0">
          <span
            className={`w-3 h-3 rounded-full transition-colors ${getDotStyle()}`}
          />
          {isHostSpeaking && (
            <span className="absolute w-3 h-3 rounded-full bg-rose-400 opacity-75 animate-ping" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-sm font-bold tracking-tight">
              ● {speakingLabel}
            </strong>
            {speakingVoiceName && (
              <span className="text-[11px] font-semibold bg-violet-200/80 text-violet-800 px-2 py-0.5 rounded-full">
                🎙️ {speakingVoiceName}
              </span>
            )}
          </div>
          <small className="text-xs text-slate-500 block truncate mt-0.5">
            {isAiSpeaking && "AI co-host audio playing through monitor"}
            {isHostSpeaking && "Host microphone live · speak freely"}
            {isPaused && "Recording paused · microphone muted"}
            {speakingState === "READY" &&
              (micReady
                ? "Microphone active · ready to record"
                : "Click Start Recording when ready")}
            {isCompleted && "Host recording captured · ready for mixing"}
            {speakingState === "ERROR" && (error || "System error occurred")}
          </small>
        </div>
      </div>

      {/* Mini equalizer wave when AI is speaking */}
      {isAiSpeaking && (
        <div className="flex items-center gap-1 flex-shrink-0 h-6">
          <span className="w-1 bg-violet-600 rounded-full h-3 animate-pulse" />
          <span
            className="w-1 bg-violet-600 rounded-full h-5 animate-pulse"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1 bg-violet-600 rounded-full h-2 animate-pulse"
            style={{ animationDelay: "300ms" }}
          />
          <span
            className="w-1 bg-violet-600 rounded-full h-6 animate-pulse"
            style={{ animationDelay: "75ms" }}
          />
          <span
            className="w-1 bg-violet-600 rounded-full h-3 animate-pulse"
            style={{ animationDelay: "200ms" }}
          />
        </div>
      )}
    </div>
  );
}
