import React from "react";

export default function SectionHeader({
  eyebrow = "",
  title,
  description = "",
  action = null,
  icon = null,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100 ${className}`}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 text-lg flex-shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div>
          {eyebrow && (
            <span className="text-[11px] font-bold tracking-wider uppercase text-violet-600 mb-1 block">
              {eyebrow}
            </span>
          )}
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex-shrink-0 self-start sm:self-center">{action}</div>
      )}
    </div>
  );
}
