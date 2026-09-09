import Button from "../common/Button";

export default function CueControls({
  currentCueIndex = -1,
  totalCues = 0,
  isAiSpeaking = false,
  isRecording = false,
  onPreviousCue,
  onNextCue,
}) {
  const allCuesCompleted = totalCues > 0 && currentCueIndex >= totalCues - 1;
  const isLastCue = totalCues > 0 && currentCueIndex >= totalCues - 1;

  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <span className="text-xs font-bold text-slate-700">
          {currentCueIndex < 0
            ? `Ready for Cue 1 of ${totalCues}`
            : allCuesCompleted
              ? "✓ All cues completed"
              : `Cue ${currentCueIndex + 1} of ${totalCues}`}
        </span>

        {allCuesCompleted && isRecording && (
          <span className="text-xs text-purple-700 font-medium">
            Host recording continues uninterrupted. Click Stop Recording when finished.
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="md"
          onClick={onPreviousCue}
          disabled={isAiSpeaking || currentCueIndex <= 0}
          title="Previous Cue"
        >
          ◀ Previous Cue
        </Button>

        <Button
          variant={allCuesCompleted ? "secondary" : "gradient"}
          size="md"
          onClick={onNextCue}
          disabled={isAiSpeaking || (totalCues > 0 && isLastCue)}
          className="flex-1 shadow-md"
        >
          {isAiSpeaking
            ? "🔊 Co-Host Speaking..."
            : allCuesCompleted
              ? "✓ All Cues Played"
              : currentCueIndex < 0
                ? "▶ Play First AI Cue"
                : "▶ Play Next AI Cue"}
        </Button>
      </div>

      {!isRecording && (
        <p className="text-xs text-slate-400 mt-3 text-center italic">
          Preview mode — cues played while you are not recording will not be added to the session timeline.
        </p>
      )}
    </div>
  );
}
