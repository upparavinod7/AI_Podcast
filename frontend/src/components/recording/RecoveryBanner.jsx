import React from "react";
import Button from "../common/Button";

export default function RecoveryBanner({
  recoverySession,
  isFinalizing = false,
  isUploading = false,
  onResumeAndFinalize,
  onDiscardSession,
}) {
  if (!recoverySession) return null;

  return (
    <div className="mb-8 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="text-2xl flex-shrink-0 mt-0.5">🔄</span>
          <div>
            <strong className="text-sm font-bold text-amber-950 block">
              Unfinalized Recording Session Detected
            </strong>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Session{" "}
              <code className="font-mono bg-amber-100/80 px-1.5 py-0.5 rounded text-amber-900 font-bold">
                {recoverySession.sessionId}
              </code>{" "}
              has {recoverySession.totalChunks} audio chunks saved locally (
              {recoverySession.uploaded} uploaded, {recoverySession.pending}{" "}
              pending, {recoverySession.failed} failed).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={onResumeAndFinalize}
            isLoading={isFinalizing}
            disabled={isFinalizing || isUploading}
          >
            {isFinalizing
              ? "Finalizing Session..."
              : "⟳ Resume Upload & Finalize"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDiscardSession}
            disabled={isFinalizing || isUploading}
          >
            ✕ Discard
          </Button>
        </div>
      </div>
    </div>
  );
}
