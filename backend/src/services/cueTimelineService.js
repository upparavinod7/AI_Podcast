const { generateCoHost } = require("./coHostService");

async function buildCueTimeline(topic, outline, voice = "alex") {
  if (typeof topic !== "string" || topic.trim().length === 0) {
    throw new Error("Topic is required");
  }

  if (typeof outline !== "string" || outline.trim().length === 0) {
    throw new Error("Outline is required");
  }

  const coHost = await generateCoHost(topic.trim(), outline.trim(), voice);

  if (!coHost || !Array.isArray(coHost.talkingPoints)) {
    throw new Error("Invalid co-host generation result");
  }

  if (coHost.talkingPoints.length === 0) {
    throw new Error("No talking points were generated");
  }

  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:5000/api";

  const cues = coHost.talkingPoints.map((point, index) => {
    const audio = point.audio || {};

    const audioFileName = audio.fileName || null;

    const durationMs = Number(audio.durationMs || 0);

    const audioUrl = audioFileName
      ? `${apiBaseUrl}/tts/audio/${encodeURIComponent(audioFileName)}`
      : null;

    const cueVoice = audio.voice?.id || point.voice || voice || "alex";
    const cueSpeaker =
      audio.voice?.name ||
      (cueVoice === "leo" ? "Leo" : cueVoice === "maaya" ? "Maaya" : "Alex");

    return {
      id: `cue-${index + 1}`,

      cueIndex: index,

      order: point.order || index + 1,

      speaker: cueSpeaker,

      voice: cueVoice,

      text: point.question || "",

      audioFile: audioFileName,

      audioUrl,

      durationMs,

      durationSeconds: Number((durationMs / 1000).toFixed(3)),

      triggerMode: "manual_next",

      status: audioFileName && durationMs > 0 ? "ready" : "not_ready",
    };
  });

  const readyCueCount = cues.filter((cue) => cue.status === "ready").length;

  if (readyCueCount === 0) {
    throw new Error("No AI cue audio is ready");
  }

  return {
    topic: topic.trim(),

    outline: outline.trim(),

    triggerMode: "manual_next",

    cueCount: cues.length,

    readyCueCount,

    cues,
  };
}

module.exports = {
  buildCueTimeline,
};
