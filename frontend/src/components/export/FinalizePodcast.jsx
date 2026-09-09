import React from "react";
import Card from "../common/Card";
import SectionHeader from "../layout/SectionHeader";
import Button from "../common/Button";
import Badge from "../common/Badge";

export default function FinalizePodcast({
  hostRecording = null,
  isFinalizing = false,
  isUploading = false,
  totalChunks = 0,
  receivedChunkCount = 0,
  failedCount = 0,
  pendingCount = 0,
  onFinalizeRecording,
  isRecording = false,
}) {
  const isFinalizeDisabled =
    isFinalizing ||
    isUploading ||
    failedCount > 0 ||
    pendingCount > 0 ||
    isRecording ||
    (totalChunks === 0 && receivedChunkCount === 0);

  return (
    <Card className="mt-8">
      <SectionHeader
        eyebrow="STEP 02"
        title="Finalize Host Recording"
        description="Verify all recorded chunks are securely uploaded to create the finalized host audio track."
        icon="🎧"
        action={
          hostRecording ? (
            <Badge variant="success" size="sm" dot>
              Track Finalized
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              Pending Finalization
            </Badge>
          )
        }
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            Concatenates uploaded Opus audio chunks using FFmpeg with continuous timeline alignment.
          </p>
          {isRecording && (
            <p className="text-xs text-amber-600 font-medium mt-1">
              Stop recording first before finalizing.
            </p>
          )}
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={onFinalizeRecording}
          isLoading={isFinalizing}
          disabled={isFinalizeDisabled}
          className="w-full sm:w-auto"
        >
          {isFinalizing ? "Finalizing Host Audio..." : "Finalize Host Recording"}
        </Button>
      </div>

      {hostRecording && (
        <div className="mt-5 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                ✓
              </span>
              <strong className="text-xs font-bold text-emerald-950">
                Host Recording Ready
              </strong>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-800">
              {Number(hostRecording.durationSeconds || 0).toFixed(2)}s
            </span>
          </div>

          <audio
            controls
            src={hostRecording.audioUrl}
            className="w-full h-9 mt-2"
          />
        </div>
      )}
    </Card>
  );
}

