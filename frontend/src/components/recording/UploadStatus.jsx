import ProgressBar from "../common/ProgressBar";
import Button from "../common/Button";

export default function UploadStatus({
  uploadedCount = 0,
  pendingCount = 0,
  failedCount = 0,
  totalChunks = 0,
  isRetrying = false,
  lastError = null,
  onRetryFailed,
}) {
  if (totalChunks === 0) return null;

  return (
    <div className="mt-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-bold text-slate-700">
          Upload Sync Status
        </span>
        {failedCount > 0 && onRetryFailed && (
          <Button
            variant="warning"
            size="sm"
            onClick={onRetryFailed}
            isLoading={isRetrying}
          >
            Retry Failed ({failedCount})
          </Button>
        )}
      </div>

      <ProgressBar
        value={uploadedCount}
        max={totalChunks}
        label={`${uploadedCount} of ${totalChunks} chunks uploaded`}
        color={failedCount > 0 ? "amber" : "violet"}
        className="mb-3"
      />

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-white rounded-lg p-2 border border-slate-100">
          <span className="text-slate-400 block text-[10px]">Uploaded</span>
          <strong className="text-emerald-600 font-bold">
            {uploadedCount}
          </strong>
        </div>
        <div className="bg-white rounded-lg p-2 border border-slate-100">
          <span className="text-slate-400 block text-[10px]">Pending</span>
          <strong className="text-amber-600 font-bold">{pendingCount}</strong>
        </div>
        <div className="bg-white rounded-lg p-2 border border-slate-100">
          <span className="text-slate-400 block text-[10px]">Failed</span>
          <strong
            className={`font-bold ${
              failedCount > 0 ? "text-rose-600" : "text-slate-400"
            }`}
          >
            {failedCount}
          </strong>
        </div>
      </div>

      {lastError && (
        <p className="text-xs text-rose-600 mt-2 font-medium bg-rose-50 p-2 rounded-lg border border-rose-100">
          ⚠️ {lastError}
        </p>
      )}
    </div>
  );
}
