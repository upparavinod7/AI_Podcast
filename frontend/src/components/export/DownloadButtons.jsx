function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function DownloadButtons({
  wavUrl = "",
  mp3Url = "",
  downloadWavUrl = "",
  downloadMp3Url = "",
  wavSize = 0,
  mp3Size = 0,
  className = "",
}) {
  const targetWav = downloadWavUrl || (wavUrl ? `${wavUrl}?download=true` : "");
  const targetMp3 = downloadMp3Url || (mp3Url ? `${mp3Url}?download=true` : "");

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {targetWav && (
        <a
          href={targetWav}
          download
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold shadow-sm hover:shadow transition-all select-none"
        >
          <span>↓ Download WAV</span>
          {wavSize > 0 && (
            <span className="text-[10px] text-slate-400 font-mono">
              ({formatBytes(wavSize)})
            </span>
          )}
        </a>
      )}

      {targetMp3 && (
        <a
          href={targetMp3}
          download
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all select-none"
        >
          <span>↓ Download MP3</span>
          {mp3Size > 0 && (
            <span className="text-[10px] text-violet-200 font-mono">
              ({formatBytes(mp3Size)})
            </span>
          )}
        </a>
      )}
    </div>
  );
}
