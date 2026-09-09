import React from "react";
import Button from "../common/Button";

export default function SessionCard({
  sessionId,
  isRecording = false,
  onCreateSession,
  onNewSession,
}) {
  return (
    <div className="bg-white/80 rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100/70 border border-violet-200/60 flex items-center justify-center text-violet-600 text-sm font-bold flex-shrink-0">
          #
        </div>
        <div>
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block">
            CURRENT SESSION
          </span>
          <code className="text-xs sm:text-sm font-mono font-semibold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded-md mt-0.5 inline-block">
            {sessionId || "No active session"}
          </code>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        {!sessionId ? (
          <Button variant="primary" size="sm" onClick={onCreateSession}>
            + Create Session
          </Button>
        ) : (
          !isRecording && (
            <Button variant="secondary" size="sm" onClick={onNewSession}>
              New Session
            </Button>
          )
        )}
      </div>
    </div>
  );
}
