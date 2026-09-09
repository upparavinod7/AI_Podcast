import { useRef, useState } from "react";

function formatSeconds(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AudioPreview({
  src,
  title = "Episode Audio",
  durationSeconds = 0,
  className = "",
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [internalDuration, setInternalDuration] = useState(0);

  const duration = durationSeconds > 0 ? durationSeconds : internalDuration;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.error("Audio playback error:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !durationSeconds) {
        setInternalDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-xs ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration) {
            setInternalDuration(audioRef.current.duration);
          }
        }}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          className="w-12 h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-violet-200 flex-shrink-0 transition-transform active:scale-95"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-800 truncate">
              {title}
            </span>
            <span className="text-xs font-mono font-medium text-slate-500">
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
