import React from "react";
import Card from "../common/Card";
import SectionHeader from "../layout/SectionHeader";
import Badge from "../common/Badge";

export default function RecordingTimelineEvents({ timelineEvents = [] }) {
  if (!timelineEvents || timelineEvents.length === 0) return null;

  return (
    <Card className="mt-8">
      <SectionHeader
        eyebrow="RECORDING TIMELINE"
        title="AI Cue Events"
        description="Captured timestamps of AI co-host cues played during your recording session."
        icon="⏱️"
        action={
          <Badge variant="purple" size="sm">
            {timelineEvents.length} event{timelineEvents.length !== 1 ? "s" : ""}
          </Badge>
        }
      />

      <div className="space-y-3 mt-2">
        {timelineEvents.map((event) => (
          <div
            key={event.eventId}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-md bg-violet-100 text-violet-700 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {event.cueIndex + 1}
              </span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <strong className="font-bold text-slate-800">
                    AI Cue {event.cueIndex + 1}
                  </strong>
                  <span className="text-[10px] uppercase font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                    {event.status}
                  </span>
                </div>
                <p className="text-slate-600 italic line-clamp-1">
                  "{event.text}"
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px] self-end sm:self-center flex-shrink-0">
              <span>
                Start:{" "}
                <strong className="text-slate-700">
                  {event.startOffsetMs !== null
                    ? `${(event.startOffsetMs / 1000).toFixed(3)}s`
                    : "—"}
                </strong>
              </span>
              <span>
                Duration:{" "}
                <strong className="text-slate-700">
                  {event.actualDurationMs !== null
                    ? `${(event.actualDurationMs / 1000).toFixed(3)}s`
                    : "—"}
                </strong>
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

