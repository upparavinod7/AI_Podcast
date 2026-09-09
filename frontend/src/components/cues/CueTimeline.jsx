import React from "react";
import Card from "../common/Card";
import SectionHeader from "../layout/SectionHeader";
import CueCard from "./CueCard";
import CueControls from "./CueControls";
import Button from "../common/Button";

export default function CueTimeline({
  cueTimeline,
  currentCueIndex = -1,
  isGeneratingCues = false,
  isAiSpeaking = false,
  isRecording = false,
  onVoiceChange,
  onGenerateSingleCue,
  onRegenerateAllCues,
  onPreviousCue,
  onNextCue,
}) {
  if (!cueTimeline || !cueTimeline.cues || cueTimeline.cues.length === 0) {
    return null;
  }

  const cues = cueTimeline.cues;
  const readyCount = cues.filter((c) => c.status === "ready" && !!c.audioUrl).length;
  const currentCue = cues[currentCueIndex] || null;

  return (
    <Card className="mt-8">
      <SectionHeader
        eyebrow="AI CUE TIMELINE"
        title="AI Co-host Questions"
        description="Play the generated cues while recording your episode. Each cue uses its selected voice."
        icon="📋"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
              <strong className="text-violet-600">{readyCount}</strong> /{" "}
              {cues.length} ready
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onRegenerateAllCues}
              disabled={isGeneratingCues}
            >
              ↻ Regenerate All Audio
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {cues.map((cue) => (
          <CueCard
            key={cue.id || cue.cueIndex}
            cue={cue}
            isCurrent={cue.cueIndex === currentCueIndex}
            isGeneratingCues={isGeneratingCues}
            onVoiceChange={onVoiceChange}
            onGenerateSingleCue={onGenerateSingleCue}
          />
        ))}
      </div>

      <CueControls
        currentCueIndex={currentCueIndex}
        totalCues={cues.length}
        currentCue={currentCue}
        isAiSpeaking={isAiSpeaking}
        isRecording={isRecording}
        onPreviousCue={onPreviousCue}
        onNextCue={onNextCue}
      />
    </Card>
  );
}

