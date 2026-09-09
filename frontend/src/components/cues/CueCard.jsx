import React from "react";
import CueStatusBadge from "./CueStatusBadge";
import CueVoiceSelector from "./CueVoiceSelector";
import Button from "../common/Button";
import { getSpeakerName, getVoiceDisplayName } from "../../services/ttsApi";

export default function CueCard({
  cue,
  isCurrent = false,
  isGeneratingCues = false,
  onVoiceChange,
  onGenerateSingleCue,
}) {
  const isGenerating = cue.status === "generating";
  const isReady = cue.status === "ready" && !!cue.audioUrl;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 p-5 ${
        isCurrent
          ? "border-violet-500 bg-violet-50/50 ring-2 ring-violet-400/50 shadow-sm"
          : "border-slate-200/80 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-7 h-7 rounded-lg bg-violet-100/80 text-violet-700 text-xs font-bold flex items-center justify-center">
            {cue.cueIndex + 1}
          </span>
          <strong className="text-sm font-bold text-slate-900">
            {cue.speaker || getSpeakerName(cue.voice)}
          </strong>
          <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
            🎙️ {getVoiceDisplayName(cue.voice)}
          </span>
          {cue.durationSeconds > 0 && (
            <span className="text-[11px] font-mono text-slate-400">
              ◷ {Number(cue.durationSeconds).toFixed(2)}s
            </span>
          )}
        </div>

        <div>
          <CueStatusBadge status={cue.status} />
        </div>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed mb-4">
        {cue.text}
      </p>

      {cue.error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl font-medium">
          ⚠️ {cue.error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <CueVoiceSelector
          selectedVoice={cue.voice}
          onVoiceChange={(voiceId) => onVoiceChange(cue.id, voiceId)}
          disabled={isGenerating || isGeneratingCues}
        />

        <Button
          variant={isReady ? "outline" : "primary"}
          size="sm"
          onClick={() => onGenerateSingleCue(cue.id)}
          isLoading={isGenerating}
          disabled={isGenerating || isGeneratingCues}
          className="self-end sm:self-auto"
        >
          {isGenerating
            ? "Generating..."
            : isReady
              ? "↻ Regenerate Speech"
              : "Generate Speech"}
        </Button>
      </div>

      {isReady && (
        <div className="mt-3.5 pt-3 border-t border-slate-100/60">
          <audio controls preload="metadata" src={cue.audioUrl} className="w-full h-9" />
        </div>
      )}
    </div>
  );
}

