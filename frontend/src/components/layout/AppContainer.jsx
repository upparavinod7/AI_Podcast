import React from "react";

export default function AppContainer({ children }) {
  return (
    <div className="min-h-screen bg-[#f8f7fc] text-slate-800 antialiased font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
        <footer className="mt-16 pt-8 border-t border-slate-200/80 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span>AI Podcast Studio</span>
          <span>•</span>
          <span>Record → Generate → Mix → Export</span>
        </footer>
      </div>
    </div>
  );
}
