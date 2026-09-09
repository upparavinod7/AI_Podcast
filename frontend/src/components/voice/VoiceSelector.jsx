import React from "react";
import { VOICES } from "../../services/ttsApi";
import VoiceCard from "./VoiceCard";

export default function VoiceSelector({
  selectedVoice = "alex",
  onSelectVoice,
  disabled = false,
  label = "Select Voice",
}) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
          {label}
        </label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {VOICES.map((voice) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            isSelected={selectedVoice === voice.id}
            onSelect={onSelectVoice}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
