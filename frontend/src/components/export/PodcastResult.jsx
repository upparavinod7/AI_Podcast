import React from "react";
import Card from "../common/Card";
import SectionHeader from "../layout/SectionHeader";
import Button from "../common/Button";
import AudioPreview from "./AudioPreview";
import DownloadButtons from "./DownloadButtons";
import AIDisclosure from "./AIDisclosure";
import Transcript from "./Transcript";

export default function PodcastResult({
  hostRecording = null,
  finalPodcast = null,
  isMixing = false,
  transcript = [],
  onMixPodcast,
}) {
  if (!hostRecording) return null;

  return (
    <Card className="mt-8 border-violet-200/80 shadow-md">
      <SectionHeader
        eyebrow="FINAL PRODUCTION"
        title="Produce & Export Final Podcast"
        description="Mix your host recording with all AI co-host cues at their precise timeline timestamps."
        icon="✨"
        action={
          <Button
            variant="gradient"
            size="md"
            onClick={onMixPodcast}
            isLoading={isMixing}
            disabled={isMixing}
          >
            {isMixing ? "Mixing & Mastering..." : "✦ Create Final Podcast"}
          </Button>
        }
      />

      {finalPodcast && (
        <div className="space-y-6 mt-4">
          <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-violet-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full text-white mb-2">
                  ✓ PODCAST READY
                </span>
                <h3 className="text-xl font-black tracking-tight">
                  Your episode has been successfully produced
                </h3>
                <p className="text-xs text-violet-100 mt-1">
                  Mastered with audio cleanup, high-pass filtering, and balanced co-host cues.
                </p>
              </div>

              <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/20 text-center sm:text-right flex-shrink-0">
                <span className="text-[11px] text-violet-200 block uppercase font-bold tracking-wider">
                  Total Duration
                </span>
                <strong className="text-2xl font-black tracking-tight font-mono">
                  {Number(finalPodcast.wav?.durationSeconds || 0).toFixed(2)}s
                </strong>
              </div>
            </div>
          </div>

          {/* Audio preview player */}
          <AudioPreview
            src={finalPodcast.mp3Url}
            title="Final Podcast Episode (Mixed Audio)"
            durationSeconds={finalPodcast.wav?.durationSeconds || 0}
          />

          {/* Download buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div>
              <strong className="text-xs font-bold text-slate-800 block">
                Export Master Files
              </strong>
              <small className="text-[11px] text-slate-500 block mt-0.5">
                Lossless 48kHz WAV or broadcast-ready 192kbps MP3.
              </small>
            </div>

            <DownloadButtons
              wavUrl={finalPodcast.wavUrl}
              mp3Url={finalPodcast.mp3Url}
              downloadWavUrl={finalPodcast.downloadWavUrl}
              downloadMp3Url={finalPodcast.downloadMp3Url}
              wavSize={finalPodcast.wav?.size}
              mp3Size={finalPodcast.mp3?.size}
            />
          </div>

          {/* Mandatory AI Disclosure */}
          <AIDisclosure />

          {/* Episode Transcript */}
          <Transcript
            transcript={transcript && transcript.length > 0 ? transcript : finalPodcast.transcript}
          />
        </div>
      )}
    </Card>
  );
}

