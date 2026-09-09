import React from "react";
import Button from "../common/Button";
import { getSpeakerName, getVoiceDisplayName } from "../../services/ttsApi";

export default function LiveCueController({
  cueTimeline,
  currentCueIndex = -1,
  currentCue = null,
  isAiSpeaking = false,
  isRecording = false,
  onPreviousCue,
  onNextCue,
}) {
  if (!cueTimeline || !cueTimeline.cues || cueTimeline.cues.length === 0) {
    return null;
  }

  const totalCues = cueTimeline.cues.length;
  const allCuesCompleted = currentCueIndex >= totalCues - 1;
  const isLastCue = currentCueIndex >= totalCues - 1;

  return (
    <div className="mt-6 rounded-2xl bg-gradient-to-br from-purple-50/60 to-violet-50/40 border border-purple-100 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/80 px-2.5 py-1 rounded-md">
          AI Co-Host Cues
        </span>
        <span className="text-xs font-semibold text-purple-800">
          {currentCueIndex < 0
            ? `Ready for Cue 1 of ${totalCues}`
            : allCuesCompleted
              ? "✓ All cues completed"
              : `Cue ${currentCueIndex + 1} of ${totalCues}`}
        </span>
      </div>

      {currentCue && (
        <div className="bg-white/90 rounded-xl p-3.5 border border-purple-100/80 mb-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <strong className="text-xs font-bold text-slate-900">
              {currentCue.speaker || getSpeakerName(currentCue.voice)}
            </strong>
            <span className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
              🎙️ {getVoiceDisplayName(currentCue.voice)}
            </span>
            {currentCue.status === "ready" && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ml-auto">
                ✓ Ready
              </span>
            )}
          </div>
          <p className="text-xs text-slate-700 italic line-clamp-3 leading-relaxed">
            "{currentCue.text}"
          </p>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPreviousCue}
          disabled={isAiSpeaking || currentCueIndex <= 0}
          title="Previous Cue"
        >
          ◀ Prev
        </Button>

        <Button
          variant={allCuesCompleted ? "secondary" : "gradient"}
          size="sm"
          onClick={onNextCue}
          disabled={isAiSpeaking || (totalCues > 0 && isLastCue)}
          className="flex-1"
        >
          {isAiSpeaking
            ? "🔊 Co-Host Speaking..."
            : allCuesCompleted
              ? "✓ All Cues Played"
              : currentCueIndex < 0
                ? "▶ Play First Cue"
                : "▶ Play Next Cue"}
        </Button>
      </div>

      {allCuesCompleted && isRecording && (
        <p className="text-[11px] text-purple-600/90 mt-2.5 text-center font-medium">
          Host recording continues. Click Stop Recording whenever you are ready.
        </p>
      )}
    </div>
  );
}
