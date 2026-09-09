import React from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import SectionHeader from "../layout/SectionHeader";

export default function SessionStatus({ status }) {
  if (!status) return null;

  return (
    <Card className="mt-8 border-dashed border-slate-300">
      <SectionHeader
        eyebrow="BACKEND"
        title="Session Status"
        icon="📊"
        action={
          <Badge
            variant={status.sequenceComplete ? "success" : "warning"}
            size="sm"
            dot
          >
            {status.sequenceComplete ? "Sequence Complete" : "In Progress"}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
          <span className="text-xs text-slate-400 font-medium block">
            Sequence
          </span>
          <strong
            className={`text-sm font-bold mt-1 block ${
              status.sequenceComplete ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {status.sequenceComplete ? "Complete" : "Incomplete"}
          </strong>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
          <span className="text-xs text-slate-400 font-medium block">
            Received Chunks
          </span>
          <strong className="text-sm font-bold text-slate-800 mt-1 block">
            {status.receivedChunkCount ?? 0}
          </strong>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
          <span className="text-xs text-slate-400 font-medium block">
            Expected Chunks
          </span>
          <strong className="text-sm font-bold text-slate-800 mt-1 block">
            {status.expectedChunkCount ?? "—"}
          </strong>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
          <span className="text-xs text-slate-400 font-medium block">
            Missing Chunks
          </span>
          <strong
            className={`text-sm font-bold mt-1 block ${
              (status.missingChunks?.length ?? 0) > 0
                ? "text-rose-600"
                : "text-slate-800"
            }`}
          >
            {status.missingChunks?.length ?? 0}
          </strong>
        </div>
      </div>
    </Card>
  );
}
