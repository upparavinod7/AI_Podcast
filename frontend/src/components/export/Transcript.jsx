import { useState } from "react";
import Button from "../common/Button";
import Badge from "../common/Badge";

function formatMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "[00:00]";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}]`;
}

export default function Transcript({ transcript = [], className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!transcript || transcript.length === 0) {
    return null;
  }

  const handleCopy = () => {
    const textLines = transcript.map(
      (entry) =>
        `${formatMs(entry.startMs)} ${entry.speaker || "Speaker"}${
          entry.voice ? ` (${entry.voice})` : ""
        }\n${entry.text}\n`,
    );
    navigator.clipboard.writeText(textLines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold">
            📝
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Episode Transcript
            </h3>
            <span className="text-xs text-slate-400">
              {transcript.length} timeline segment
              {transcript.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              title="Copy transcript to clipboard"
            >
              {copied ? "✓ Copied" : "Copy Text"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "Hide Transcript ▲" : "View Transcript ▼"}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3.5 max-h-96 overflow-y-auto pr-1">
          {transcript.map((item, idx) => {
            const isHost = item.speaker === "Host";

            return (
              <div
                key={item.cueId || idx}
                className={`p-3.5 rounded-xl border transition-colors ${
                  isHost
                    ? "bg-slate-50/70 border-slate-200/80"
                    : "bg-violet-50/40 border-violet-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {formatMs(item.startMs)}
                    </span>
                    <strong
                      className={`text-xs font-bold ${
                        isHost ? "text-slate-800" : "text-violet-900"
                      }`}
                    >
                      {item.speaker || "Co-Host"}
                    </strong>
                    {item.voice && (
                      <Badge variant="purple" size="xs">
                        🎙️ {item.voice}
                      </Badge>
                    )}
                  </div>

                  {item.endMs > item.startMs && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {((item.endMs - item.startMs) / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>

                <p
                  className={`text-xs leading-relaxed ${
                    isHost ? "text-slate-500 italic" : "text-slate-800"
                  }`}
                >
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
