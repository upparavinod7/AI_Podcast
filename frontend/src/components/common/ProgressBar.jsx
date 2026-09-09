import React from "react";

export default function ProgressBar({
  value = 0,
  max = 100,
  label = "",
  color = "violet",
  className = "",
}) {
  const percentage = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));

  const colorMap = {
    violet: "bg-gradient-to-r from-violet-600 to-purple-600",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    blue: "bg-blue-500",
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-600 mb-1.5">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            colorMap[color] || colorMap.violet
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

