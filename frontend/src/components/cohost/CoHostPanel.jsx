import Card from "../common/Card";
import SectionHeader from "../layout/SectionHeader";
import VoiceSelector from "../voice/VoiceSelector";
import Button from "../common/Button";
import { VOICES } from "../../services/ttsApi";

export default function CoHostPanel({
  selectedVoice = "alex",
  onSelectVoice,
  topic = "",
  onTopicChange,
  outline = "",
  onOutlineChange,
  isGeneratingCues = false,
  onGenerateCues,
  onLoadSampleCues,
}) {
  const activeVoiceObj = VOICES.find((v) => v.id === selectedVoice);

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <SectionHeader
          eyebrow="AI CO-HOST"
          title="Plan your AI conversation"
          description="Choose your AI co-host voice, provide a topic and outline, and generate questions with synthesized voice audio."
          icon="✦"
        />

        <div className="mb-5">
          <VoiceSelector
            selectedVoice={selectedVoice}
            onSelectVoice={onSelectVoice}
            disabled={isGeneratingCues}
            label="Co-Host Voice"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
              placeholder="e.g. Artificial Intelligence in Software Development"
              disabled={isGeneratingCues}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Outline & Key Points
            </label>
            <textarea
              value={outline}
              onChange={(e) => onOutlineChange(e.target.value)}
              rows={4}
              placeholder="Discuss the main points, questions and ideas for the episode..."
              disabled={isGeneratingCues}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all resize-y"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 pt-4 border-t border-slate-100">
        <Button
          variant="gradient"
          size="md"
          onClick={onGenerateCues}
          isLoading={isGeneratingCues}
          disabled={isGeneratingCues}
          className="w-full sm:w-auto"
        >
          ✦ Generate AI Cues ({activeVoiceObj?.name || "Alex"})
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={onLoadSampleCues}
          disabled={isGeneratingCues}
          className="w-full sm:w-auto"
        >
          ✦ Load Sample Cues
        </Button>
      </div>
    </Card>
  );
}
