import React from "react";

export default function ErrorMessage({
  title = "Error",
  message,
  onDismiss = null,
  className = "",
}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`rounded-xl bg-rose-50 border border-rose-200/90 p-4 text-rose-900 flex items-start gap-3 shadow-sm ${className}`}
    >
      <span className="text-lg flex-shrink-0 text-rose-600">⚠️</span>
      <div className="flex-1 min-w-0 text-sm">
        {title && <strong className="font-semibold block mb-0.5">{title}</strong>}
        <p className="text-rose-700 leading-relaxed break-words">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-rose-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-100 transition-colors"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}

