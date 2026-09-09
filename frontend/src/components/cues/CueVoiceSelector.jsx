import React from "react";
import { VOICES } from "../../services/ttsApi";

export default function CueVoiceSelector({
  selectedVoice = "alex",
  onVoiceChange,
  disabled = false,
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-semibold text-slate-500 mr-1">Voice:</span>
      {VOICES.map((v) => {
        const isActive = selectedVoice === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onVoiceChange(v.id)}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none ${
              isActive
                ? "bg-violet-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {v.name}
          </button>
        );
      })}
    </div>
  );
}

