
export default function AIDisclosure({ className = "" }) {
  return (
    <div
      className={`flex items-start sm:items-center gap-3 px-4 py-3.5 rounded-xl bg-violet-50/90 border border-violet-200 text-violet-900 text-xs shadow-xs ${className}`}
    >
      <span className="text-base flex-shrink-0 text-violet-600 mt-0.5 sm:mt-0">✦</span>
      <div className="flex-1 leading-relaxed">
        <p className="font-semibold text-violet-950">
          AI-Generated Content: This podcast episode was co-hosted and voiced using synthetic AI voices.
        </p>
        <p className="text-[11px] text-violet-700 mt-0.5 font-medium">
          Synthetic audio powered by Piper TTS local models: Alex (Ryan), Leo (Joe), and Maaya (Amy).
        </p>
      </div>
      <span className="hidden sm:inline-flex px-2.5 py-1 rounded-md bg-violet-100 text-[10px] font-mono font-bold text-violet-800 uppercase tracking-wide">
        Synthetic Audio
      </span>
    </div>
  );
}
