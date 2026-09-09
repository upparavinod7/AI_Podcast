import React from "react";

export default function VoiceCard({
  voice,
  isSelected = false,
  onSelect,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(voice.id)}
      disabled={disabled}
      className={`relative flex items-center gap-3 w-full p-4 rounded-xl text-left border transition-all duration-200 select-none ${
        isSelected
          ? "border-violet-600 bg-violet-50/70 shadow-sm ring-1 ring-violet-500"
          : "border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50/60"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-colors ${
          isSelected
            ? "bg-violet-600 text-white shadow-sm"
            : "bg-violet-100/70 text-violet-700"
        }`}
      >
        🎙️
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <strong className="text-sm font-bold text-slate-900 block truncate">
            {voice.name}
          </strong>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 bg-violet-100/80 px-1.5 py-0.5 rounded">
            {voice.gender}
          </span>
        </div>
        <small className="text-xs text-slate-500 block truncate mt-0.5">
          {voice.description}
        </small>
      </div>

      {isSelected && (
        <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
          ✓
        </span>
      )}
    </button>
  );
}
